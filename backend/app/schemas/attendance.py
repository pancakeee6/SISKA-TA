from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID


# --- AI API Response ---

class FaceRecognitionResult(BaseModel):
    name: str
    status: str
    event_type: str  # "IN" or "OUT"
    late: bool


class RecognizeResponse(BaseModel):
    status: str
    faces: list[FaceRecognitionResult]


# --- Attendance Schemas ---

class AttendanceLogResponse(BaseModel):
    id: int
    user_id: UUID
    user_name: Optional[str] = None
    event_type: str
    timestamp: datetime
    status: str
    late: bool
    device_id: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class AttendanceListResponse(BaseModel):
    logs: list[AttendanceLogResponse]
    total: int
    page: int
    per_page: int
