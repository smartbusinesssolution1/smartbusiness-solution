from fastapi import APIRouter, File, UploadFile, HTTPException
from typing import Annotated
import hashlib
import logging

from config import settings
from schemas import VerificationResponse, ErrorResponse
from service import decode_image, verify_faces, estimate_pose_only

logger = logging.getLogger(__name__)
router = APIRouter()

# Frame-hash cache for /pose — if the user is holding still, consecutive
# poll frames hash-match and we skip MediaPipe entirely.
_pose_cache: dict = {}
_POSE_CACHE_MAX = 50


# ── MAIN MULTI-SELFIE VERIFICATION ───────────────────────────────────────

@router.post(
    "/verify",
    response_model=VerificationResponse,
    responses={
        400: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Verify identity using 4 self-consistent selfies (no reference photo)",
)
async def verify_identity(
    selfie_images: Annotated[list[UploadFile], File(description="Exactly 4 selfies: front, left, right, front-confirm")],
):
    if len(selfie_images) != settings.MAX_SELFIE_IMAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Exactly {settings.MAX_SELFIE_IMAGES} selfie images required.",
        )

    selfie_arrays, selfie_filenames = [], []
    for upload in selfie_images:
        raw = await upload.read()
        selfie_arrays.append(decode_image(raw, upload.filename or "selfie.jpg"))
        selfie_filenames.append(upload.filename or "selfie.jpg")

    result = verify_faces(
        selfie_images=selfie_arrays,
        selfie_filenames=selfie_filenames,
    )
    logger.info(f"Result: {result.status} | conf={result.confidence_score} | ratio={result.match_ratio}")
    return result


# ── LIVE POSE ENDPOINT ────────────────────────────────────────────────────
# Frontend calls this every ~1000 ms with one camera frame, gets back the
# real yaw/pitch/roll plus per-slot validity flags. No face detection
# (InsightFace) is run here — MediaPipe FaceMesh only — so it stays fast.
# Client pre-filters empty frames before calling this at all; frames with
# an identical hash to a recent one (user holding still) skip MediaPipe
# entirely via the cache below.

@router.post(
    "/pose",
    summary="Real-time head-pose estimation",
    description=(
        "Send a single image frame; receive yaw / pitch / roll in degrees "
        "plus boolean validity flags for each selfie slot (front/left/right). "
        "Designed to be called repeatedly from a webcam preview."
    ),
)
async def get_pose(
    image: Annotated[UploadFile, File(description="Single frame (JPEG/PNG)")],
):
    raw = await image.read()

    # Fast fingerprint on first 2KB — near-identical frames (user holding
    # still) hash the same, skipping MediaPipe entirely.
    frame_hash = hashlib.md5(raw[:2048]).hexdigest()
    cached = _pose_cache.get(frame_hash)
    if cached is not None:
        return cached

    img = decode_image(raw, image.filename or "frame.jpg")
    pose = estimate_pose_only(img)

    if len(_pose_cache) >= _POSE_CACHE_MAX:
        _pose_cache.pop(next(iter(_pose_cache)))
    _pose_cache[frame_hash] = pose

    return pose


# NOTE: the old "/verify/quick" 1-vs-1 reference-vs-selfie endpoint was removed —
# it doesn't fit selfie-only verification (there's no reference photo anymore).
# If you still need ad-hoc 2-image comparisons for debugging, POST both images
# as selfie_images to /verify along with 2 more to fill REQUIRED_SELFIE_COUNT,
# or call service.cosine_distance() directly on two embeddings.