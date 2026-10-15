"""
Active / Burst Liveness
========================

Single-frame heuristics (see liveness.py) can be beaten by a decent photo
or a video played on a phone held up to the camera — there is no way to
tell a static high-quality print/screen apart from a real face using only
color/texture/frequency analysis on ONE frame. To meaningfully raise the
bar toward "production grade", liveness needs to look at CHANGE OVER TIME
and, ideally, ask the user to do something a photo can't do.

This module analyzes a short burst of frames (client captures a handful of
frames over ~1-1.5 seconds) and checks:

1. **Blink detection** (optional, off by default — see config.REQUIRE_BLINK)
   Uses MediaPipe FaceMesh eye landmarks to compute the Eye Aspect Ratio
   (EAR) per frame. When REQUIRE_BLINK is True, a real face asked to blink
   must show an EAR dip (open -> closed -> open) WITHIN THE SUBMITTED
   FRAMES or the attempt is rejected. In the current default setup, blink
   is instead enforced client-side as a one-time gate before capture even
   starts (see test_attendance.html) — the submitted frames themselves are
   captured fresh afterward and don't need to individually contain a
   blink. Requiring the blink inside the exact submitted frames is
   stricter but brittle: blinks are ~100-400ms and the frames sent don't
   always land on that exact window, which was causing real, live blinks
   to be reported as "no blink detected" and rejected. Turn
   REQUIRE_BLINK back on only if you also change the client to submit a
   continuous buffer spanning the blink event (frame-buffer approach)
   rather than a fresh post-blink capture.

2. **Inter-frame motion sanity check**
   A perfectly rigid, pixel-identical sequence (someone holding a printed
   photo very still) or a sequence with unnaturally periodic brightness
   oscillation (screen refresh/backlight flicker) is flagged. Real faces
   held in front of a camera always show small natural motion (breathing,
   micro head movement, blinking itself).

3. Per-frame passive heuristics (liveness.check_liveness) are run on a
   SAMPLE of frames (not all of them — see PASSIVE_SAMPLE_MAX below) and
   averaged in, so screen-cast/print artifacts caught there still count
   without paying the full per-frame heuristic cost on every frame.

Performance notes (this module used to be a meaningful chunk of request
latency):
  - The MediaPipe FaceMesh model is now created ONCE at import time and
    reused across requests, instead of being constructed fresh on every
    single call (model construction is the expensive part, not inference).
  - The five-signal passive heuristic check (moire/reflection/texture/
    dynamic-range/bezel — each involves an FFT, Hough transform, etc.) now
    runs on a small evenly-spaced sample of frames instead of every frame
    in the burst, since a handful of samples is enough to catch a
    photo/screen artifact that's present throughout the whole burst anyway.

None of this makes the system unbeatable — see README.md's "production
notes" for what a genuinely high-assurance deployment needs on top of this
(trained anti-spoof model, IR/depth camera, server-issued random
challenges, etc). What it does do is close the two biggest gaps in the
single-frame version: **static photos** and **plain video replay without
a matching live challenge**.
"""

import logging
from dataclasses import dataclass, field

import cv2
import numpy as np

from liveness import check_liveness

logger = logging.getLogger(__name__)

# Run the (relatively expensive) 5-signal passive heuristic check on at
# most this many evenly-spaced frames from the burst, instead of all of
# them. A photo/screen/print artifact is present in every frame anyway, so
# a small sample catches it just as reliably at a fraction of the cost.
PASSIVE_SAMPLE_MAX = 3

# Eye landmark indices (MediaPipe FaceMesh, 468-point model)
_LEFT_EYE = [33, 160, 158, 133, 153, 144]
_RIGHT_EYE = [362, 385, 387, 263, 373, 380]

# ── MediaPipe FaceMesh: built ONCE and reused ────────────────────────────
# Constructing a FaceMesh instance loads/initializes the underlying model
# graph and is by far the most expensive part of this check — doing it
# fresh on every request (as an earlier version of this file did) added
# real latency to every single attendance attempt for no benefit, since
# the instance is safe to reuse across independent static images.
try:
    import mediapipe as mp
    _face_mesh = mp.solutions.face_mesh.FaceMesh(
        static_image_mode=True, max_num_faces=1, refine_landmarks=True,
        min_detection_confidence=0.5,
    )
    _HAS_MEDIAPIPE = True
except Exception as _e:  # broken install, wrong Python version, etc.
    logger.warning(
        f"mediapipe unavailable ({_e}) — blink detection disabled, "
        f"falling back to motion-only active liveness. Fix your mediapipe "
        f"install (Python 3.9-3.12 required) to re-enable blink checks."
    )
    _face_mesh = None
    _HAS_MEDIAPIPE = False


@dataclass
class BurstLivenessResult:
    score: float
    is_live: bool
    blink_detected: bool
    motion_ok: bool
    reasons: list[str] = field(default_factory=list)
    per_frame_scores: list[float] = field(default_factory=list)


def _eye_aspect_ratio(landmarks, idxs, w, h) -> float:
    pts = np.array([[landmarks[i].x * w, landmarks[i].y * h] for i in idxs])
    v1 = np.linalg.norm(pts[1] - pts[5])
    v2 = np.linalg.norm(pts[2] - pts[4])
    hlen = np.linalg.norm(pts[0] - pts[3])
    if hlen == 0:
        return 0.3
    return float((v1 + v2) / (2.0 * hlen))


def _extract_ear_sequence(frames: list[np.ndarray]) -> list[float | None]:
    if not _HAS_MEDIAPIPE:
        return [None] * len(frames)
    ears = []
    for frame in frames:
        h, w = frame.shape[:2]
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        res = _face_mesh.process(rgb)
        if not res.multi_face_landmarks:
            ears.append(None)
            continue
        lm = res.multi_face_landmarks[0].landmark
        left = _eye_aspect_ratio(lm, _LEFT_EYE, w, h)
        right = _eye_aspect_ratio(lm, _RIGHT_EYE, w, h)
        ears.append((left + right) / 2.0)
    return ears


def _blink_detected(ear_sequence: list[float | None],
                     closed_thresh: float = 0.19,
                     open_thresh: float = 0.24) -> bool:
    """True if the sequence shows open -> closed -> open (a real blink)."""
    vals = [e for e in ear_sequence if e is not None]
    if len(vals) < 3:
        return False
    seen_open_before = False
    seen_closed = False
    for e in ear_sequence:
        if e is None:
            continue
        if e >= open_thresh:
            if seen_closed:
                return True
            seen_open_before = True
        elif e <= closed_thresh and seen_open_before:
            seen_closed = True
    return False


def _motion_check(frames: list[np.ndarray], bboxes: list[tuple]) -> tuple[bool, float, list[str]]:
    """
    Returns (motion_ok, mean_frame_diff, reasons). Flags two failure modes:
      - near-zero motion across the whole burst (rigid photo)
      - strongly periodic brightness oscillation (screen refresh/flicker)
    """
    reasons = []
    diffs = []
    brightness = []

    grays = []
    for frame, bbox in zip(frames, bboxes):
        x1, y1, x2, y2 = [int(v) for v in bbox]
        crop = frame[max(0, y1):y2, max(0, x1):x2]
        if crop.size == 0:
            crop = frame
        g = cv2.cvtColor(cv2.resize(crop, (120, 120)), cv2.COLOR_BGR2GRAY)
        grays.append(g)
        brightness.append(float(g.mean()))

    for a, b in zip(grays, grays[1:]):
        diffs.append(float(np.mean(cv2.absdiff(a, b))))

    mean_diff = float(np.mean(diffs)) if diffs else 0.0

    motion_ok = True
    if mean_diff < 0.8:
        motion_ok = False
        reasons.append("almost no motion between frames (looks like a static photo)")

    # Periodic brightness oscillation = screen refresh/backlight flicker.
    if len(brightness) >= 4:
        b = np.array(brightness)
        b = b - b.mean()
        if b.std() > 0.5:
            ac1 = float(np.corrcoef(b[:-1], b[1:])[0, 1]) if len(b) > 2 else 0.0
            if ac1 < -0.5:
                motion_ok = False
                reasons.append("periodic brightness flicker detected (possible screen refresh)")

    return motion_ok, mean_diff, reasons


def _sample_indices(n: int, max_samples: int) -> list[int]:
    """Evenly-spaced frame indices to run the passive heuristic check on."""
    if n <= max_samples:
        return list(range(n))
    return sorted(set(np.linspace(0, n - 1, max_samples).round().astype(int).tolist()))


def analyze_burst(
    frames: list[np.ndarray],
    bboxes: list[tuple],
    passive_threshold: float,
    require_blink: bool = True,
) -> BurstLivenessResult:
    if len(frames) < 3:
        return BurstLivenessResult(
            score=0.0, is_live=False, blink_detected=False, motion_ok=False,
            reasons=["burst too short — need at least 3 frames"],
        )

    sample_idx = _sample_indices(len(frames), PASSIVE_SAMPLE_MAX)
    per_frame_scores = []
    reasons: list[str] = []
    for i in sample_idx:
        r = check_liveness(frames[i], bboxes[i], threshold=passive_threshold)
        per_frame_scores.append(r.score)
        for reason in r.reasons:
            if reason not in reasons:
                reasons.append(reason)

    passive_avg = float(np.mean(per_frame_scores))

    ear_seq = _extract_ear_sequence(frames)
    blink = _blink_detected(ear_seq)
    effective_require_blink = require_blink and _HAS_MEDIAPIPE
    if not _HAS_MEDIAPIPE:
        reasons.append(
            "blink detection unavailable (mediapipe not installed correctly) "
            "— relying on motion + passive checks only"
        )
    elif effective_require_blink and not blink:
        reasons.append("no blink detected during capture")

    motion_ok, mean_diff, motion_reasons = _motion_check(frames, bboxes)
    reasons.extend(r for r in motion_reasons if r not in reasons)

    # Combine: passive per-frame average is the base signal; blink and
    # motion are HARD GATES — a perfect passive score with no blink and no
    # motion is still almost certainly a spoof, so it can't pass on
    # passive score alone.
    score = passive_avg
    if effective_require_blink and not blink:
        score *= 0.4
    if not motion_ok:
        score *= 0.5

    # Blink is a hard requirement when available: no blink -> not live,
    # full stop, regardless of how high the other signals score.
    is_live = score >= passive_threshold and motion_ok and (blink or not effective_require_blink)

    return BurstLivenessResult(
        score=round(float(np.clip(score, 0.0, 1.0)), 4),
        is_live=is_live,
        blink_detected=blink,
        motion_ok=motion_ok,
        reasons=reasons,
        per_frame_scores=[round(s, 4) for s in per_frame_scores],
    )