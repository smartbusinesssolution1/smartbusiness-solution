from typing import Annotated

from fastapi import APIRouter, File, Form, UploadFile

from challenge import issue_challenge
from schemas import AttendanceBurstResponse, ChallengeResponse, DetectFaceResponse, ErrorResponse
from service import decode_image, detect_face_for_preview, mark_attendance_burst

router = APIRouter()


@router.post(
    "/face/detect",
    response_model=DetectFaceResponse,
    responses={400: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
    summary="Detect a face in an image and return its bounding box (for UI overlay only)",
)
async def face_detect(
    image: Annotated[UploadFile, File(description="Image to run face detection on")],
):
    """
    Used by the test page (and can be used by any client) purely to draw a
    circle/oval guide around the detected face on top of the preview —
    does not do any matching or liveness scoring.
    """
    raw = await image.read()
    arr = decode_image(raw, image.filename or "frame.jpg")
    return detect_face_for_preview(arr)


@router.get(
    "/attendance/challenge",
    response_model=ChallengeResponse,
    summary="Get a fresh single-use random liveness challenge (call before every capture)",
)
async def attendance_challenge():
    return issue_challenge()


@router.post(
    "/attendance/mark-burst",
    response_model=AttendanceBurstResponse,
    responses={
        400: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Mark attendance from a live capture burst that performs the server's random head-turn challenge",
)
def attendance_mark_burst(
    profile_image: Annotated[UploadFile, File(description="Stored profile photo (reference)")],
    capture_images: Annotated[list[UploadFile], File(description="Frames in capture order: frontal, [turn, frontal] per challenge step")],
    challenge_token: Annotated[str, Form(description="Token from GET /attendance/challenge (single use)")],
):
    """
    The ONLY attendance endpoint — live capture is mandatory. The client must
    fetch a challenge, make the user perform the listed head turns, and send
    the frames in the order captured. Single-photo upload was removed on
    purpose: it cannot carry a liveness challenge.
    """
    profile_arr = decode_image(profile_image.file.read(), profile_image.filename or "profile.jpg")
    frames = [
        decode_image(u.file.read(), u.filename or f"frame_{i}.jpg")
        for i, u in enumerate(capture_images)
    ]
    return mark_attendance_burst(
        profile_img=profile_arr,
        capture_frames=frames,
        profile_filename=profile_image.filename or "profile.jpg",
        challenge_token=challenge_token,
    )