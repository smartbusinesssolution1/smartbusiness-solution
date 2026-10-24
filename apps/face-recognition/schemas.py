from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class AttendanceStatus(str, Enum):
    MARKED = "marked"          # face matched + passed liveness
    REJECTED = "rejected"      # face did not match profile photo
    SPOOF_SUSPECTED = "spoof_suspected"  # failed liveness check


class BurstLivenessDetail(BaseModel):
    is_live: bool
    liveness_score: float = Field(..., ge=0.0, le=1.0)
    blink_detected: bool
    motion_ok: bool
    challenge_ok: bool = False
    screen_detected: bool = False
    reasons: list[str] = Field(default_factory=list)
    per_frame_scores: list[float] = Field(default_factory=list)


class AttendanceBurstResponse(BaseModel):
    status: AttendanceStatus
    is_match: bool
    match_confidence: float = Field(..., ge=0.0, le=1.0)
    distance: float
    liveness: BurstLivenessDetail
    message: str


class FaceBox(BaseModel):
    x1: int
    y1: int
    x2: int
    y2: int


class DetectFaceResponse(BaseModel):
    detected: bool
    box: Optional[FaceBox] = None
    image_width: int
    image_height: int


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None


class ChallengeResponse(BaseModel):
    challenge_token: str
    steps: list[str] = Field(default_factory=list, description="Ordered head turns, each 'left' or 'right' (user's own left/right). Empty = blink-only mode.")
    expires_in: int
    frontal_max: float
    turn_min: float
    left_yaw_sign: int
    blink_step: bool
    blink_closed_ratio: float
    blink_open_ratio: float
    pre_frontal_frames: int
    expected_frames: int