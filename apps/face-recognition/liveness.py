"""
Passive Liveness / Anti-Spoof Checks
=====================================

Goal: given ONE still frame from the attendance camera, estimate whether it
shows a real, live face in front of the camera -- as opposed to a common
spoof: a printed photo, a phone/tablet/laptop screen held up to the camera,
or a photo of a photo.

IMPORTANT / HONEST LIMITATION
------------------------------
This is a *heuristic* passive-liveness module, not a trained deep-learning
anti-spoof model (e.g. Silent-Face-Anti-Spoofing, MiniFASNet). It works from
a single RGB frame and looks for texture/frequency/reflection artifacts that
are common in photo-of-a-photo and screen-replay attacks. It raises the bar
for casual spoofing attempts (printing a profile pic, holding up a phone)
but it is NOT a certified liveness product and can be fooled by a
high-quality print/replay or a determined attacker. For high-assurance use
cases, pair this with:
  - an active challenge (ask user to blink / turn head / read a random
    number) verified across a short burst of frames, and/or
  - a proper trained anti-spoof model, and/or
  - depth/IR camera hardware.

Signals combined into one score (each normalized to 0-1, higher = "more
likely real"):

1. Moire / screen-replay detection (FFT high-frequency energy)
   Re-photographing a digital screen produces periodic interference
   patterns (moire) that show up as unusually strong / structured
   high-frequency energy in the frequency domain.

2. Reflection / glare detection
   Screens and glossy prints commonly produce sharp specular highlights
   (small, very bright, low-saturation blobs) that skin under normal
   ambient light rarely produces at the same concentration.

3. Texture micro-detail check (blur / over-smoothing)
   A print or a low-res screen recapture tends to be either unnaturally
   blurry (lost fine skin/hair detail) or unnaturally uniform. We check the
   Laplacian variance of the face region against a plausible "real skin"
   band rather than just "not blurry".

4. Color/dynamic-range check
   Printed photos and screen recaptures usually compress the dynamic range
   (fewer distinct tones, color casts from print ink or screen backlight).
   We check the intensity histogram spread within the face region.

5. Flat-rectangle / frame-edge check
   A photo of a photo often has a detectable rectangular border (the edge
   of the printed paper, phone, or screen bezel) somewhere near the face.
   We scan for long, mostly-straight, mostly-parallel edge lines around the
   face bounding box.

`check_liveness()` returns an overall 0-1 score plus a list of the specific
signals that looked suspicious, so callers/UI can explain a rejection.
"""

from dataclasses import dataclass, field
import cv2
import numpy as np


@dataclass
class LivenessResult:
    score: float
    is_live: bool
    reasons: list[str] = field(default_factory=list)


def _face_crop(img_bgr: np.ndarray, bbox, margin: float = 0.15) -> np.ndarray:
    h, w = img_bgr.shape[:2]
    x1, y1, x2, y2 = [int(v) for v in bbox]
    bw, bh = x2 - x1, y2 - y1
    mx, my = int(bw * margin), int(bh * margin)
    x1, y1 = max(0, x1 - mx), max(0, y1 - my)
    x2, y2 = min(w, x2 + mx), min(h, y2 + my)
    return img_bgr[y1:y2, x1:x2]


def _moire_score(gray: np.ndarray) -> float:
    """Higher return value = more likely real (less moire)."""
    if gray.size == 0:
        return 0.5
    g = cv2.resize(gray, (256, 256)).astype(np.float32)
    f = np.fft.fftshift(np.fft.fft2(g))
    mag = np.log1p(np.abs(f))

    h, w = mag.shape
    cy, cx = h // 2, w // 2
    # Ignore the low-frequency core (overall shape/lighting) — we only care
    # about the mid/high band where moire interference patterns live.
    yy, xx = np.ogrid[:h, :w]
    r = np.sqrt((yy - cy) ** 2 + (xx - cx) ** 2)
    band = (r > min(h, w) * 0.15) & (r < min(h, w) * 0.45)

    band_energy = mag[band]
    if band_energy.size == 0:
        return 0.5
    # A real face photographed normally has fairly smooth, low mid-band
    # energy. Screen moire shows up as sharp peaks -> high variance/mean.
    ratio = float(band_energy.mean() / (mag.mean() + 1e-6))
    # Empirically, ratio > ~1.15 tends to indicate structured interference.
    score = 1.0 - np.clip((ratio - 0.9) / 0.5, 0.0, 1.0)
    return float(np.clip(score, 0.0, 1.0))


def _reflection_score(face_bgr: np.ndarray) -> float:
    """Higher = fewer suspicious glare/reflection blobs."""
    if face_bgr.size == 0:
        return 0.5
    hsv = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2HSV)
    v, s = hsv[:, :, 2], hsv[:, :, 1]
    # Very bright AND very low-saturation pixels = specular highlight, not skin.
    glare_mask = (v > 240) & (s < 30)
    glare_ratio = float(glare_mask.mean())
    score = 1.0 - np.clip(glare_ratio / 0.05, 0.0, 1.0)  # >5% glare pixels = bad
    return float(score)


def _texture_score(face_bgr: np.ndarray) -> float:
    """Higher = plausible natural skin micro-texture (not too flat, not noise)."""
    if face_bgr.size == 0:
        return 0.5
    gray = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2GRAY)
    lap_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    # Too low  -> over-smoothed print / low-res screen recapture.
    # Too high -> aggressive sharpening / moire noise artifacts.
    # Plausible real-camera-in-focus-face band (empirical, tune per camera).
    lo, hi = 25.0, 1400.0
    if lap_var < lo:
        score = lap_var / lo
    elif lap_var > hi:
        score = max(0.0, 1.0 - (lap_var - hi) / (hi * 2))
    else:
        score = 1.0
    return float(np.clip(score, 0.0, 1.0))


def _dynamic_range_score(face_bgr: np.ndarray) -> float:
    """Higher = healthy tonal spread (real ambient-lit skin)."""
    if face_bgr.size == 0:
        return 0.5
    gray = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2GRAY)
    std = gray.std()
    # Very low std -> flat/washed-out reproduction typical of a poor print
    # or a screen recapture with backlight blowout.
    score = np.clip(std / 35.0, 0.0, 1.0)
    return float(score)


def _frame_border_score(img_bgr: np.ndarray, bbox) -> float:
    """
    Higher = no obvious rectangular photo/screen border detected around
    the face. Looks for long, straight, axis-aligned-ish edge lines in a
    ring around the face bbox (paper edge, phone bezel, monitor frame).
    """
    h, w = img_bgr.shape[:2]
    x1, y1, x2, y2 = [int(v) for v in bbox]
    bw, bh = x2 - x1, y2 - y1
    pad = int(max(bw, bh) * 1.0)
    rx1, ry1 = max(0, x1 - pad), max(0, y1 - pad)
    rx2, ry2 = min(w, x2 + pad), min(h, y2 + pad)
    region = img_bgr[ry1:ry2, rx1:rx2]
    if region.size == 0:
        return 1.0

    gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 60, 160)
    min_len = int(0.55 * min(region.shape[:2]))
    lines = cv2.HoughLinesP(
        edges, 1, np.pi / 180, threshold=80,
        minLineLength=max(20, min_len), maxLineGap=10,
    )
    if lines is None:
        return 1.0

    long_straight = 0
    for l in lines:
        # cv2.HoughLinesP's returned line shape is (N, 1, 4) on some
        # OpenCV builds and (N, 4) on others — np.ravel handles both
        # instead of assuming l[0] is the 4-tuple (which crashed with
        # "cannot unpack non-iterable numpy.int32 object" on builds that
        # return (N, 4)).
        x1l, y1l, x2l, y2l = np.ravel(l)[:4]
        angle = abs(np.degrees(np.arctan2(y2l - y1l, x2l - x1l)))
        # near-horizontal or near-vertical long lines are the suspicious kind
        if angle < 8 or angle > 82:
            long_straight += 1

    score = 1.0 - np.clip(long_straight / 6.0, 0.0, 1.0)
    return float(score)


def _device_bezel_score(img_bgr: np.ndarray) -> float:
    """
    Higher = no obvious phone/tablet bezel visible at the edges of the
    FULL frame. When someone holds up a phone/photo to the camera, the
    outer border of the captured frame is very often a dark, low-texture
    band (the bezel, a table edge, or the back of the device/paper) that
    is visually distinct from a normal room background. We sample thin
    strips along all four edges of the whole image and flag them if they
    are unusually dark AND unusually flat (low variance).
    """
    h, w = img_bgr.shape[:2]
    if h < 20 or w < 20:
        return 1.0
    strip = max(4, int(min(h, w) * 0.04))
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    edges = [
        gray[0:strip, :],
        gray[h - strip:h, :],
        gray[:, 0:strip],
        gray[:, w - strip:w],
    ]
    flat_dark_count = 0
    for e in edges:
        if e.size == 0:
            continue
        if e.mean() < 60 and e.std() < 18:
            flat_dark_count += 1

    score = 1.0 - np.clip(flat_dark_count / 3.0, 0.0, 1.0)
    return float(score)


def _screen_color_cast_score(img_bgr: np.ndarray, bbox) -> float:
    """
    Higher = no strong uniform blue/cyan color cast across the whole
    frame. Phone/tablet/monitor screens are backlit and very commonly
    push a slight-to-strong blue/cyan tint across the ENTIRE captured
    image (not just the face), including areas that should be neutral
    room background. Real ambient-lit scenes are rarely this uniformly
    blue-shifted end to end.
    """
    h, w = img_bgr.shape[:2]
    x1, y1, x2, y2 = [int(v) for v in bbox]
    mask = np.ones((h, w), dtype=bool)
    mask[max(0, y1):min(h, y2), max(0, x1):min(w, x2)] = False
    bg = img_bgr[mask]
    if bg.size == 0:
        return 1.0
    b, g, r = bg[:, 0].astype(np.float32), bg[:, 1].astype(np.float32), bg[:, 2].astype(np.float32)
    cast = float((b.mean() - r.mean()))  # positive = blue-shifted
    score = 1.0 - np.clip((cast - 8.0) / 25.0, 0.0, 1.0)
    return float(np.clip(score, 0.0, 1.0))


def check_liveness(img_bgr: np.ndarray, bbox, threshold: float) -> LivenessResult:
    """
    Run all heuristic checks on the detected face and combine them into one
    liveness score. `bbox` is (x1, y1, x2, y2) from the face detector.
    """
    face = _face_crop(img_bgr, bbox)
    face_gray = cv2.cvtColor(face, cv2.COLOR_BGR2GRAY) if face.size else np.zeros((1, 1), np.uint8)

    checks = {
        "possible screen replay / moire pattern": (_moire_score(face_gray), 0.18),
        "unnatural glare/reflection on face":      (_reflection_score(face), 0.16),
        "unnatural texture (too flat or too noisy)": (_texture_score(face), 0.18),
        "flat/washed-out tone (low dynamic range)":  (_dynamic_range_score(face), 0.12),
        "photo/screen frame edge detected near face": (_frame_border_score(img_bgr, bbox), 0.12),
        "device bezel/edge visible in frame":       (_device_bezel_score(img_bgr), 0.12),
        "uniform blue/screen color cast":           (_screen_color_cast_score(img_bgr, bbox), 0.12),
    }

    overall = sum(score * weight for score, weight in checks.values())
    reasons = [label for label, (score, _w) in checks.items() if score < 0.5]

    return LivenessResult(
        score=round(float(overall), 4),
        is_live=overall >= threshold,
        reasons=reasons,
    )