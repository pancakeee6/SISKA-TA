from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone, timedelta

from app.db.database import get_db
from app.api.deps import get_current_admin
from app.models.attendance import AttendanceLog
from app.models.user import User
from app.models.activity_log import ActivityLog
from app.models.admin import Admin
from sqlalchemy.orm import selectinload
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


@router.get("/monthly")
async def get_monthly_stats(
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """Get monthly attendance statistics (last 6 months)."""
    today = datetime.now(timezone.utc).date()
    
    monthly = []
    for i in range(5, -1, -1):
        m = (today.month - i - 1) % 12 + 1
        y = today.year + ((today.month - i - 1) // 12)
        monthly.append({
            "year": y,
            "month": m,
            "present": 0,
            "late": 0,
        })
        
    start_date = datetime(monthly[0]["year"], monthly[0]["month"], 1).date()
    
    query = select(
        func.date(AttendanceLog.timestamp).label("date"),
        AttendanceLog.late,
        func.count(func.distinct(AttendanceLog.user_id)).label("count")
    ).where(
        func.date(AttendanceLog.timestamp) >= start_date,
        AttendanceLog.event_type == "IN"
    ).group_by(
        func.date(AttendanceLog.timestamp),
        AttendanceLog.late
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    for row in rows:
        r_date_str = str(row.date)
        r_year = int(r_date_str[:4])
        r_month = int(r_date_str[5:7])
        
        for m in monthly:
            if m["year"] == r_year and m["month"] == r_month:
                if row.late:
                    m["late"] += row.count
                else:
                    m["present"] += row.count
                    
    # Format output
    output = []
    month_names = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"]
    for m in monthly:
        output.append({
            "day": month_names[m["month"] - 1],
            "full_name": f"{month_names[m['month'] - 1]} {m['year']}",
            "present": m["present"],
            "late": m["late"]
        })
        
    return output


@router.get("/activities")
async def get_recent_activities(
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """Get unified recent activities (attendance + admin logs)"""
    # 1. Get attendance logs
    att_query = select(AttendanceLog).options(selectinload(AttendanceLog.user)).order_by(AttendanceLog.timestamp.desc()).limit(limit)
    att_result = await db.execute(att_query)
    attendance_logs = att_result.scalars().all()
    
    # 2. Get activity logs
    act_query = select(ActivityLog).options(selectinload(ActivityLog.admin)).order_by(ActivityLog.created_at.desc()).limit(limit)
    act_result = await db.execute(act_query)
    activity_logs = act_result.scalars().all()
    
    # Normalize event_type (1st scan = IN, 2nd scan = OUT) for dashboard display
    user_day_counts = {}
    sorted_att = sorted(attendance_logs, key=lambda x: x.timestamp or datetime.min.replace(tzinfo=timezone.utc))
    normalized_types = {}
    for l in sorted_att:
        date_key = f"{l.user_id}_{l.timestamp.strftime('%Y-%m-%d') if l.timestamp else 'unknown'}"
        count = user_day_counts.get(date_key, 0) + 1
        user_day_counts[date_key] = count
        normalized_types[l.id] = "IN" if count % 2 != 0 else "OUT"

    # 3. Combine and map to common schema
    unified = []
    for log in attendance_logs:
        unified.append({
            "id": f"att-{log.id}",
            "user_name": log.user.full_name if log.user else "Unknown",
            "event_type": normalized_types.get(log.id, log.event_type), # "IN" or "OUT"
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            "late": log.late,
            "category": "ATTENDANCE"
        })
        
    for log in activity_logs:
        unified.append({
            "id": f"act-{log.id}",
            "user_name": log.admin.full_name if log.admin else "Administrator",
            "event_type": log.action,  
            "timestamp": log.created_at.isoformat() if log.created_at else None,
            "late": False,
            "category": "ADMIN"
        })
        
    # Remove logs without timestamp just in case
    unified = [u for u in unified if u["timestamp"] is not None]
        
    # Sort descending by timestamp
    unified.sort(key=lambda x: x["timestamp"], reverse=True)
    
    return {"items": unified[:limit]}
