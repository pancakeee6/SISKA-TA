from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone, timedelta

from app.db.database import get_db
from app.api.deps import get_current_admin
from app.models.attendance import AttendanceLog
from app.models.user import User
from app.schemas.dashboard import DashboardStats

router = APIRouter()


@router.get("/stats", response_model=DashboardStats)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """Get today's attendance statistics."""
    today = datetime.now(timezone.utc).date()

    # Total active users
    total_result = await db.execute(
        select(func.count()).select_from(User).where(User.is_active == True)
    )
    total = total_result.scalar()

    # Users who checked in today
    present_result = await db.execute(
        select(func.count(func.distinct(AttendanceLog.user_id))).where(
            func.date(AttendanceLog.timestamp) == today,
            AttendanceLog.event_type == "IN",
        )
    )
    present = present_result.scalar()

    # Late today
    late_result = await db.execute(
        select(func.count(func.distinct(AttendanceLog.user_id))).where(
            func.date(AttendanceLog.timestamp) == today,
            AttendanceLog.late == True,
        )
    )
    late = late_result.scalar()

    absent = max(0, total - present)

    return DashboardStats(
        total=total,
        present=present,
        late=late,
        absent=absent,
    )


@router.get("/weekly")
async def get_weekly_stats(
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """Get weekly attendance statistics (last 7 days)."""
    today = datetime.now(timezone.utc).date()
    weekly = []

    for i in range(6, -1, -1):
        day = today - timedelta(days=i)

        present_result = await db.execute(
            select(func.count(func.distinct(AttendanceLog.user_id))).where(
                func.date(AttendanceLog.timestamp) == day,
                AttendanceLog.event_type == "IN",
            )
        )
        present = present_result.scalar()

        late_result = await db.execute(
            select(func.count(func.distinct(AttendanceLog.user_id))).where(
                func.date(AttendanceLog.timestamp) == day,
                AttendanceLog.late == True,
            )
        )
        late = late_result.scalar()

        weekly.append({
            "day": day.strftime("%a %d/%m"),
            "present": present,
            "late": late,
        })

    return weekly
