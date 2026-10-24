"""
Attendance Face-Matching Service
=================================
Live-capture-only attendance flow:

    profile_image (stored reference)  --\
                                          >-- match (frontal frames) --> mark
    live burst + server random challenge --/   + active/passive liveness

One InsightFace model does detection + embedding (ArcFace via buffalo_sc).
Liveness: random head-turn challenge, screen-border detection, passive
heuristics (see motion_liveness.py).
"""

import io
import logging

import cv2
import numpy as np
from PIL import Image
from fastapi import HTTPException
from insightface.app import FaceAnalysis

from config import settings
from challenge import expected_frames, verify_and_consume
from motion_liveness import analyze_burst, extract_features
from schemas import (
    AttendanceBurstResponse,
    AttendanceStatus,
    BurstLivenessDetail,
    DetectFaceResponse,
    FaceBox,
)

logger = logging.getLogger(__name__)


# ── Model Loading ────────────────────────────────────────────────────────

def _load_model(name: str, det_size=(640, 640)) -> FaceAnalysis:
    app = FaceAnalysis(name=name, providers=["CPUExecutionProvider"])
    app.prepare(ctx_id=-1, det_size=det_size)
    logger.info(f"InsightFace model '{name}' loaded.")
    return app


try:
    face_app = _load_model(settings.RECOGNITION_MODEL, det_size=(640, 640))
except Exception as e:  # pragma: no cover - environment dependent
    logger.error(f"Failed to load face model '{settings.RECOGNITION_MODEL}': {e}")
    face_app = None

# Second instance with a smaller detector input for burst capture frames —
# these are always close-up selfie shots, so a smaller det_size loses
# essentially no accuracy but detects noticeably faster (less pixels to
# run the detector over). Profile photos (which may be shot from further
# away / cropped from a bigger picture) still use the full-size `face_app`.
try:
    face_app_fast = _load_model(settings.RECOGNITION_MODEL, det_size=settings.BURST_DET_SIZE)
except Exception as e:  # pragma: no cover - environment dependent
    logger.error(f"Failed to load fast face model: {e}")
    face_app_fast = face_app


# ── Image Decoding ───────────────────────────────────────────────────────

def decode_image(image_bytes: bytes, filename: str) -> np.ndarray:
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"'{filename}' has unsupported format. Allowed: {settings.ALLOWED_EXTENSIONS}",
        )
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if len(image_bytes) > max_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"'{filename}' exceeds {settings.MAX_FILE_SIZE_MB} MB limit.",
        )
    try:
        arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is not None:
            return img
    except Exception:
        pass
    try:
        pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        return np.array(pil)[:, :, ::-1]
    except Exception:
        pass
    raise HTTPException(
        status_code=400,
        detail=f"Could not read '{filename}'. Please try a different photo.",
    )


# ── Face Detection ───────────────────────────────────────────────────────

def _largest_face(faces):
    return max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))


def _detect_faces_with_app(img_bgr: np.ndarray, app):
    if app is None:
        return []
    try:
        return app.get(cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB))
    except Exception as e:
        logger.warning(f"InsightFace detection error with one detector: {e}")
        return []


def _detect_one_face(img_bgr: np.ndarray, filename: str, app=None, fallback: bool = True):
    """
    Detect a single face, trying `app` first and — if nothing is found —
    falling back to the other loaded detector before giving up.

    Why this matters: the fast 320px detector (used for quick burst
    frames) can miss faces in photos where the face is smaller/further
    from frame than a close-up selfie — which is exactly what a typical
    profile picture looks like. Previously a missed detection on the
    faster model just failed outright ("No face detected") even though
    the accurate model would have found it fine. Now both are tried.
    """
    primary = app or face_app
    faces = _detect_faces_with_app(img_bgr, primary)

    if not faces and fallback:
        secondary = face_app if primary is face_app_fast else face_app_fast
        if secondary is not None and secondary is not primary:
            faces = _detect_faces_with_app(img_bgr, secondary)

    if primary is None and not faces:
        raise HTTPException(status_code=500, detail="Face recognition model not loaded.")
    if not faces:
        raise HTTPException(
            status_code=422,
            detail=(
                f"No face detected in '{filename}'. Make sure the face is clearly "
                f"visible, well-lit, and not too small/far in the frame."
            ),
        )
    face = _largest_face(faces) if len(faces) > 1 else faces[0]

    x1, y1, x2, y2 = face.bbox
    if (x2 - x1) < settings.MIN_FACE_SIZE_PX or (y2 - y1) < settings.MIN_FACE_SIZE_PX:
        raise HTTPException(
            status_code=422,
            detail=f"Face in '{filename}' is too small/far from the camera.",
        )
    return face


def cosine_distance(a, b) -> float:
    a, b = np.asarray(a, dtype=np.float32), np.asarray(b, dtype=np.float32)
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 1.0
    return float(1.0 - np.dot(a, b) / (na * nb))


def _distance_to_confidence(distance: float, threshold: float) -> float:
    return float(max(0.0, min(1.0, 1.0 - distance / (threshold * 2.0))))


def detect_face_for_preview(img_bgr: np.ndarray) -> DetectFaceResponse:
    """
    Lightweight detection-only call used by the frontend to draw a
    face-outline guide (a circle/oval) over the preview image. Does not
    run matching or liveness — just: is there a face, and where.

    Tries the FAST (320px) detector first for speed, and falls back to
    the accurate 640px detector if nothing is found — this is what fixes
    profile photos (where the face is often smaller/further from frame
    than a close-up selfie) failing to detect after the earlier speed
    optimization that used only the fast detector.
    """
    h, w = img_bgr.shape[:2]
    if face_app is None and face_app_fast is None:
        raise HTTPException(status_code=500, detail="Face recognition model not loaded.")

    faces = _detect_faces_with_app(img_bgr, face_app_fast)
    if not faces:
        faces = _detect_faces_with_app(img_bgr, face_app)

    if not faces:
        return DetectFaceResponse(detected=False, image_width=w, image_height=h)

    face = _largest_face(faces) if len(faces) > 1 else faces[0]
    x1, y1, x2, y2 = [int(v) for v in face.bbox]
    return DetectFaceResponse(
        detected=True,
        box=FaceBox(x1=x1, y1=y1, x2=x2, y2=y2),
        image_width=w,
        image_height=h,
    )


# ── Main attendance check ────────────────────────────────────────────────

def _try_detect_face(img_bgr: np.ndarray):
    """Largest face or None (never raises). Tries fast detector, then full."""
    for app in (face_app_fast, face_app):
        if app is None:
            continue
        faces = _detect_faces_with_app(img_bgr, app)
        if faces:
            f = _largest_face(faces) if len(faces) > 1 else faces[0]
            x1, y1, x2, y2 = f.bbox
            if (x2 - x1) >= settings.MIN_FACE_SIZE_PX and (y2 - y1) >= settings.MIN_FACE_SIZE_PX:
                return f
            return None
    return None


def mark_attendance_burst(
    profile_img: np.ndarray,
    capture_frames: list[np.ndarray],
    profile_filename: str,
    challenge_token: str,
) -> AttendanceBurstResponse:
    """
    Live capture vs stored profile photo. Frames must be in capture order and
    perform the server's random head-turn challenge (frontal, then
    [turn, frontal] per step, then closed-eye + open-eye blink frames). See motion_liveness.py.
    """
    if face_app is None and face_app_fast is None:
        raise HTTPException(status_code=500, detail="Face recognition model not loaded.")

    n_steps = settings.CHALLENGE_STEPS
    expected = expected_frames()
    if len(capture_frames) != expected:
        raise HTTPException(
            status_code=400,
            detail=f"Expected exactly {expected} capture frames, got {len(capture_frames)}.",
        )

    # Burns the token (single use) — validated before any heavy work.
    steps = verify_and_consume(challenge_token)
    if len(steps) != n_steps:
        raise HTTPException(status_code=400, detail="Challenge does not match server settings. Retake.")

    profile_face = _detect_one_face(profile_img, profile_filename)

    features = extract_features(capture_frames)
    faces = [_try_detect_face(f) for f in capture_frames]
    bboxes = [f.bbox if f is not None else None for f in faces]

    burst = analyze_burst(
        capture_frames, features, bboxes, steps,
        passive_threshold=settings.LIVENESS_THRESHOLD,
        frontal_max=settings.FRONTAL_MAX,
        turn_min=settings.TURN_MIN,
        left_sign=settings.LEFT_YAW_SIGN,
        min_frontal_frames=settings.MIN_FRONTAL_FRAMES,
        pre_frontal_frames=settings.PRE_FRONTAL_FRAMES,
        blink_step=settings.BLINK_STEP,
        blink_closed_ratio=settings.BLINK_CLOSED_RATIO,
        blink_open_ratio=settings.BLINK_OPEN_RATIO,
        screen_hard_reject=settings.SCREEN_BORDER_HARD_REJECT,
    )
    liveness_detail = BurstLivenessDetail(
        is_live=burst.is_live,
        liveness_score=burst.score,
        blink_detected=burst.blink_detected,
        motion_ok=burst.motion_ok,
        challenge_ok=burst.challenge_ok,
        screen_detected=burst.screen_detected,
        reasons=burst.reasons,
        per_frame_scores=burst.per_frame_scores,
    )

    # Identity: majority of FRONTAL frames must match the profile photo.
    # Turned frames only need to be "not an obviously different person".
    frontal_faces = [(i, faces[i]) for i in burst.frontal_indices if faces[i] is not None]
    frontal = [i for i, _ in frontal_faces]
    if frontal_faces:
        f_dist = [cosine_distance(profile_face.embedding, f.embedding) for _, f in frontal_faces]
        avg_distance = float(np.mean(f_dist))
        matched = sum(1 for d in f_dist if d < settings.MATCH_THRESHOLD)
        is_match = matched >= (len(f_dist) // 2 + 1)
    else:
        avg_distance, is_match = 1.0, False
    if is_match:
        frontal_set = set(frontal)
        for i, f in enumerate(faces):
            if i not in frontal_set and f is not None:
                if cosine_distance(profile_face.embedding, f.embedding) > settings.SAME_PERSON_MAX_DIST:
                    is_match = False
                    break
    confidence = round(_distance_to_confidence(avg_distance, settings.MATCH_THRESHOLD), 4)

    if not burst.is_live:
        status = AttendanceStatus.SPOOF_SUSPECTED
        message = f"Liveness check failed — {', '.join(burst.reasons) or 'low overall score'}."
    elif is_match:
        status = AttendanceStatus.MARKED
        message = f"Attendance marked. Face matched profile photo (confidence {confidence:.2f})."
    else:
        status = AttendanceStatus.REJECTED
        message = f"Face did not match the profile photo (confidence {confidence:.2f})."

    logger.info(
        f"[ATTENDANCE-BURST] steps={steps} yaws={[None if y is None else round(y, 2) for y in burst.yaws]} "
        f"match={is_match} avg_dist={avg_distance:.4f} live={burst.is_live} score={burst.score} "
        f"challenge={burst.challenge_ok} screen={burst.screen_detected} -> {status}"
    )

    return AttendanceBurstResponse(
        status=status,
        is_match=is_match,
        match_confidence=confidence,
        distance=round(avg_distance, 4),
        liveness=liveness_detail,
        message=message,
    )