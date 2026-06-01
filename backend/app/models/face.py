import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.database import Base


class FaceData(Base):
    __tablename__ = "face_data"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    embedding_json = Column(Text, nullable=True)   # Nullable: embedding dikelola ML API
    image_path = Column(String(500), nullable=True)  # Path to original face image
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", back_populates="face_data")

    def __repr__(self):
        return f"<FaceData user_id={self.user_id}>"
