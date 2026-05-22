from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, BigInteger
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db.database import Base


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("admins.id"), nullable=False)
    action = Column(String(50), nullable=False)  # e.g., "create_user", "delete_face"
    target_type = Column(String(50), nullable=True)  # e.g., "user", "face_data"
    target_id = Column(UUID(as_uuid=True), nullable=True)
    details = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    admin = relationship("Admin", back_populates="activity_logs")

    def __repr__(self):
        return f"<ActivityLog {self.action} by {self.admin_id}>"
