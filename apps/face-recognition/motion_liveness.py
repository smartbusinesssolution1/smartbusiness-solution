"""
Active liveness for a burst of frames, driven by a SERVER-ISSUED random
head-turn challenge (see challenge.py).

Why: a pre-recorded video of the right person blinking (played on a laptop
in front of the phone) beats any blink check, because blinking is predictable.
A random sequence of head turns (e.g. LEFT then RIGHT) chosen by the server
per attempt is not -- the replay would have to contain exactly that sequence.

Checks (all must pass, fail-closed):
  1. Optional challenge sequence (CHALLENGE_STEPS > 0, off by default): from
     per-frame FaceMesh yaw, frames must show frontal -> [turn(dir) ->
     frontal] x N, in order.
  2. Screen/photo border around the face (screen_detect.py) on frontal frames.
  3. Passive heuristics (liveness.check_liveness) on a sample of frontal frames.
  4. Blink step: after the final "back to camera", eyes close then reopen
     (relative to the user's own open-eye EAR).
  5. Not a rigid photo: some inter-frame motion.
If MediaPipe is unavailable the burst FAILS (no silent downgrade).

Still heuristic -- no trained anti-spoof model, no depth/IR. See README.
"""

import logging
import threading
from collections.abc import Sequence
from dataclasses import dataclass, field

import cv2
import numpy as np

from liveness import check_liveness
from screen_detect import detect_screen_around_face

logger = logging.getLogger(__name__)

PASSIVE_SAMPLE_MAX = 3

# FaceMesh indices
_LEFT_EYE = [33, 160, 158, 133, 153, 144]
_RIGHT_EYE = [362, 385, 387, 263, 373, 380]
_EYE_OUTER_A, _EYE_OUTER_B, _NOSE_TIP = 33, 263, 1

try:
    import mediapipe as mp
    _face_mesh = mp.solutions.face_mesh.FaceMesh(
        static_image_mode=True, max_num_faces=1, refine_landmarks=True,
        min_detection_confidence=0.5,
    )
    _HAS_MEDIAPIPE = True
except Exception as _e:  # broken install / unsupported Python
    logger.error(
        f"mediapipe unavailable ({_e}) — active liveness will FAIL every "
        f"attempt. Install mediapipe==0.10.14 on Python 3.9-3.12."
    )
    _face_mesh = None
    _HAS_MEDIAPIPE = False

_mesh_lock = threading.Lock()  # FaceMesh instance is not thread-safe


@dataclass
class FrameFeatures:
    ear: float
    yaw: float
    bbox: tuple[float, float, float, float]  # landmark-based face box (px)


@dataclass
class BurstLivenessResult:
    score: float
    is_live: bool
    blink_detected: bool
    motion_ok: bool
    challenge_ok: bool = False
    screen_detected: bool = False
    reasons: list[str] = field(default_factory=list)
    per_frame_scores: list[float] = field(default_factory=list)
    yaws: list[float | None] = field(default_factory=list)
    frontal_indices: list[int] = field(default_factory=list)


def _ear(pts: np.ndarray, idxs) -> float:
    p = pts[idxs]
    v1 = np.linalg.norm(p[1] - p[5])
    v2 = np.linalg.norm(p[2] - p[4])
    hl = np.linalg.norm(p[0] - p[3])
    return 0.3 if hl == 0 else float((v1 + v2) / (2.0 * hl))


def yaw_ratio_from_points(nose_xy, a_xy, b_xy) -> float:
    """(nose_x - eye_mid_x) / eye_dist, pixel space. Same math as the client."""
    mid_x = (a_xy[0] + b_xy[0]) / 2.0
    d = float(np.hypot(b_xy[0] - a_xy[0], b_xy[1] - a_xy[1]))
    return 0.0 if d == 0 else float((nose_xy[0] - mid_x) / d)


def extract_features(frames: list[np.ndarray]) -> list[FrameFeatures | None]:
    if not _HAS_MEDIAPIPE or _face_mesh is None:
        return [None] * len(frames)
    out: list[FrameFeatures | None] = []
    for frame in frames:
        h, w = frame.shape[:2]
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        with _mesh_lock:
            res = _face_mesh.process(rgb)
        if not res.multi_face_landmarks:
            out.append(None)
            continue
        lm = res.multi_face_landmarks[0].landmark
        pts = np.array([[p.x * w, p.y * h] for p in lm], dtype=np.float32)
        ear = (_ear(pts, _LEFT_EYE) + _ear(pts, _RIGHT_EYE)) / 2.0
        yaw = yaw_ratio_from_points(pts[_NOSE_TIP], pts[_EYE_OUTER_A], pts[_EYE_OUTER_B])
        x1, y1 = pts.min(axis=0)
        x2, y2 = pts.max(axis=0)
        out.append(FrameFeatures(float(ear), float(yaw), (float(x1), float(y1), float(x2), float(y2))))
    return out


def verify_challenge_sequence_idx(
    yaws: Sequence[float | None],
    steps: Sequence[str],
    frontal_max: float,
    turn_min: float,
    left_sign: int,
) -> tuple[bool, str | None, int]:
    """Frames must show: frontal, then for each step: turn(dir) -> frontal.
    Returns (ok, reason, index of the final frontal frame)."""
    n = len(yaws)

    def frontal(i):
        y = yaws[i]
        return y is not None and abs(y) <= frontal_max

    def turned(i, sign):
        y = yaws[i]
        return y is not None and y * sign >= turn_min

    first = next((i for i in range(n) if frontal(i)), None)
    if first is None:
        return False, "no frontal (camera-facing) frame at start", -1
    p = first + 1
    last = first
    for k, step in enumerate(steps):
        sign = left_sign if step == "left" else -left_sign
        t = next((i for i in range(p, n) if turned(i, sign)), None)
        if t is None:
            return False, f"challenge failed: head turn {k + 1} ({step}) not seen", -1
        c = next((i for i in range(t + 1, n) if frontal(i)), None)
        if c is None:
            return False, f"challenge failed: no return to camera after turn {k + 1}", -1
        p = c + 1
        last = c
    return True, None, last


def verify_challenge_sequence(yaws, steps, frontal_max, turn_min, left_sign) -> tuple[bool, str | None]:
    ok, why, _ = verify_challenge_sequence_idx(yaws, steps, frontal_max, turn_min, left_sign)
    return ok, why


def verify_blink_after(
    ears: Sequence[float | None],
    yaws: Sequence[float | None],
    start_idx: int,
    baseline_idxs: Sequence[int],
    frontal_max: float,
    closed_ratio: float,
    open_ratio: float,
) -> tuple[bool, str | None, int]:
    """After start_idx (final back-to-camera frame): eyes closed, then open
    again, both facing the camera. Relative to the user's own open-eye EAR.
    Returns (ok, reason, index of the closed-eye frame)."""
    base_vals = [float(e) for e in (ears[i] for i in baseline_idxs) if e is not None]
    if len(base_vals) < 1:
        return False, "blink step failed: no open-eye baseline", -1
    base = float(np.median(base_vals))
    n = len(ears)

    def eye_ok(i, test):
        e, y = ears[i], yaws[i]
        return e is not None and y is not None and abs(y) <= frontal_max and test(e)

    j = next((i for i in range(start_idx + 1, n) if eye_ok(i, lambda e: e <= closed_ratio * base)), None)
    if j is None:
        return False, "blink step failed: no closed-eye frame after returning to camera", -1
    k = next((i for i in range(j + 1, n) if eye_ok(i, lambda e: e >= open_ratio * base)), None)
    if k is None:
        return False, "blink step failed: eyes not seen reopening", -1
    return True, None, j


def _is_frontal(value: float | None, yaw: float | None, frontal_max: float) -> bool:
    """value (ear or yaw) was measured AND the face was camera-facing."""
    return value is not None and yaw is not None and abs(yaw) <= frontal_max


def _motion_ok(frames, bboxes) -> tuple[bool, list[str]]:
    grays = []
    for frame, bbox in zip(frames, bboxes):
        x1, y1, x2, y2 = [int(v) for v in bbox]
        crop = frame[max(0, y1):max(0, y2), max(0, x1):max(0, x2)]
        if crop.size == 0:
            crop = frame
        grays.append(cv2.cvtColor(cv2.resize(crop, (120, 120)), cv2.COLOR_BGR2GRAY))
    diffs = [float(np.mean(cv2.absdiff(a, b))) for a, b in zip(grays, grays[1:])]
    if (float(np.mean(diffs)) if diffs else 0.0) < 0.8:
        return False, ["almost no motion between frames (looks like a static photo)"]
    return True, []


def _sample(indices: list[int], k: int) -> list[int]:
    if len(indices) <= k:
        return list(indices)
    pos = np.linspace(0, len(indices) - 1, k).round().astype(int).tolist()
    return [indices[i] for i in sorted(set(pos))]


def analyze_burst(
    frames: list[np.ndarray],
    features: list[FrameFeatures | None],
    face_bboxes: list[tuple | None],
    steps: list[str],
    passive_threshold: float,
    frontal_max: float,
    turn_min: float,
    left_sign: int,
    min_frontal_frames: int,
    pre_frontal_frames: int = 1,
    blink_step: bool = True,
    blink_closed_ratio: float = 0.75,
    blink_open_ratio: float = 0.80,
    screen_hard_reject: bool = True,
) -> BurstLivenessResult:
    """
    face_bboxes[i]: InsightFace box for frame i, or None if not detected
    (allowed for turned frames). Falls back to the landmark box for motion.
    """
    reasons: list[str] = []
    n = len(frames)
    yaws = [f.yaw if f else None for f in features]

    def fail(msg: str, **kw) -> BurstLivenessResult:
        return BurstLivenessResult(
            score=0.0, is_live=False, blink_detected=False, motion_ok=False,
            reasons=reasons + [msg], yaws=yaws, **kw,
        )

    if not _HAS_MEDIAPIPE:
        return fail("liveness engine unavailable (mediapipe not installed) — failing closed")

    # 1. Challenge sequence -------------------------------------------------
    challenge_ok, why, last_idx = verify_challenge_sequence_idx(yaws, steps, frontal_max, turn_min, left_sign)
    if not challenge_ok:
        return fail(why or "challenge failed")

    # 1b. Blink step (after the final "back to camera") ---------------------
    ears = [f.ear if f else None for f in features]
    blink = False
    closed_idx = -1
    if blink_step:
        # Open-eye baseline = median over all camera-facing frames (robust:
        # most are open). Blink frames must come AFTER the pre-frames/turns.
        base_idxs = [i for i in range(n) if _is_frontal(ears[i], yaws[i], frontal_max)]
        start = max(last_idx, pre_frontal_frames - 1)
        blink, bwhy, closed_idx = verify_blink_after(
            ears, yaws, start, base_idxs, frontal_max, blink_closed_ratio, blink_open_ratio)
        if not blink:
            return fail(bwhy or "blink step failed", challenge_ok=True)

    # Frontal frames usable for identity + passive checks (need a detected face).
    frontal_idx = [
        i for i in range(n)
        if _is_frontal(yaws[i], yaws[i], frontal_max) and face_bboxes[i] is not None
        and i != closed_idx
    ]
    if len(frontal_idx) < min_frontal_frames:
        return fail(
            f"need at least {min_frontal_frames} clear camera-facing frames, got {len(frontal_idx)}",
            challenge_ok=True,
        )

    sample = _sample(frontal_idx, PASSIVE_SAMPLE_MAX)

    # 2. Screen / photo border ---------------------------------------------
    flagged = 0
    for i in sample:
        det = detect_screen_around_face(frames[i], face_bboxes[i])
        if det.detected:
            flagged += 1
            for r in det.reasons:
                if r not in reasons:
                    reasons.append(r)
    need = (len(sample) + 1) // 2
    screen_detected = flagged >= need

    # 3. Passive heuristics -------------------------------------------------
    per_frame = []
    for i in sample:
        r = check_liveness(frames[i], face_bboxes[i], threshold=passive_threshold)
        per_frame.append(r.score)
        for reason in r.reasons:
            if reason not in reasons:
                reasons.append(reason)
    passive_avg = float(np.mean(per_frame))

    # 4. Motion / blink (info) ---------------------------------------------
    motion_bboxes = []
    for i in range(n):
        fb, ft = face_bboxes[i], features[i]
        if fb is not None:
            motion_bboxes.append(fb)
        elif ft is not None:
            motion_bboxes.append(ft.bbox)
        else:
            motion_bboxes.append((0, 0, frames[i].shape[1], frames[i].shape[0]))
    motion_ok, motion_reasons = _motion_ok(frames, motion_bboxes)
    reasons.extend(r for r in motion_reasons if r not in reasons)

    score = passive_avg
    if not motion_ok:
        score *= 0.5
    if screen_detected and screen_hard_reject:
        score *= 0.3

    is_live = (
        challenge_ok
        and motion_ok
        and score >= passive_threshold
        and not (screen_detected and screen_hard_reject)
    )

    return BurstLivenessResult(
        score=round(float(np.clip(score, 0.0, 1.0)), 4),
        is_live=is_live,
        blink_detected=blink,
        motion_ok=motion_ok,
        challenge_ok=challenge_ok,
        screen_detected=screen_detected,
        reasons=reasons,
        per_frame_scores=[round(s, 4) for s in per_frame],
        yaws=yaws,
        frontal_indices=frontal_idx,
    )