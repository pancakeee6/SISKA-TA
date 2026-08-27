import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(String(50), unique=True, nullable=False, index=True)
    full_name = Column(String(100), nullable=False)
    email = Column(String(100), nullable=True)
    department = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    avatar_path = Column(String(255), nullable=True)
    ml_person_id = Column(Integer, nullable=True)  # Mapping ke ML API person ID (temporary)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    face_data = relationship("FaceData", back_populates="user", cascade="all, delete-orphan")
    attendance_logs = relationship("AttendanceLog", back_populates="user")

    @property
    def avatar(self):
        try:
            if self.avatar_path:
                path = self.avatar_path.replace('\\', '/')
                return f"/api/v1/{path}"
            if self.face_data:
                profile_face = next((f for f in self.face_data if f.is_profile), self.face_data[0])
                path = profile_face.image_path.replace('\\', '/')
                return f"/api/v1/{path}"
            return None
        except Exception:
            return None

    @property
    def face_count(self) -> int:
        try:
            return len(self.face_data)
        except Exception:
            return 0

    def __repr__(self):
        return f"<User {self.full_name}>"
