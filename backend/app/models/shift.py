from sqlalchemy import Column, Integer, String
from app.db.database import Base


class WorkShift(Base):
    __tablename__ = "work_shifts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    start_time = Column(String, nullable=False)  # e.g., "08:00"
    end_time = Column(String, nullable=False)    # e.g., "15:00"
    late_tolerance = Column(Integer, default=15) # minutes
