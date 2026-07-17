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
    shift_label: Optional[str] = None
    late_duration: Optional[str] = None
    late_minutes: Optional[int] = None


class RecognizeResponse(BaseModel):
    status: str
    faces: list[FaceRecognitionResult]


class AttendanceDinasCreate(BaseModel):
    user_id: UUID
    date: Optional[str] = None  # Format YYYY-MM-DD
    keterangan: Optional[str] = "Dinas Luar Kota"


# --- Attendance Schemas ---

class AttendanceLogResponse(BaseModel):
    id: int
    user_id: UUID
    user_name: Optional[str] = None
    employee_id: Optional[str] = None
    event_type: str
    timestamp: datetime
    status: str
    late: bool
    device_id: Optional[str]
    created_at: datetime
    shift_label: Optional[str] = None
    late_duration: Optional[str] = None
    late_minutes: Optional[int] = None

    class Config:
        from_attributes = True


class AttendanceListResponse(BaseModel):
    logs: list[AttendanceLogResponse]
    total: int
    page: int
    per_page: int
