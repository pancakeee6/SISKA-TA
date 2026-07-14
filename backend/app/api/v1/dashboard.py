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
    """Get today's attendance statistics using index-friendly timestamp range query."""
    now_utc = datetime.now(timezone.utc)
    wib_tz = timezone(timedelta(hours=7))
    now_wib = now_utc.astimezone(wib_tz)
    today = now_wib.date()
    start_dt_wib = datetime.combine(today, datetime.min.time(), tzinfo=wib_tz)
    end_dt_wib = datetime.combine(today, datetime.max.time(), tzinfo=wib_tz)
    start_dt = start_dt_wib.astimezone(timezone.utc)
    end_dt = end_dt_wib.astimezone(timezone.utc)

    # Total active users
    total_result = await db.execute(
        select(func.count(User.id)).where(User.is_active == True)
    )
    total = total_result.scalar() or 0

    # Present and late today in ONE single index scan query
    att_result = await db.execute(
        select(
            AttendanceLog.late,
            func.count(func.distinct(AttendanceLog.user_id))
        ).where(
            AttendanceLog.timestamp >= start_dt,
            AttendanceLog.timestamp <= end_dt,
            AttendanceLog.event_type == "IN",
        ).group_by(AttendanceLog.late)
    )
    rows = att_result.all()
    on_time_count = 0
    late_count = 0
    for r in rows:
        if r[0]:
            late_count += r[1]
        else:
            on_time_count += r[1]
            
    present = on_time_count + late_count
    late = late_count
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
    """Get weekly attendance statistics using indexed timestamp range."""
    today = datetime.now(timezone.utc).date()
    start_date = today - timedelta(days=6)
    start_dt = datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc)

    query = select(
        func.date(AttendanceLog.timestamp).label("date"),
        AttendanceLog.late,
        func.count(func.distinct(AttendanceLog.user_id)).label("count")
    ).where(
        AttendanceLog.timestamp >= start_dt,
        AttendanceLog.event_type == "IN"
    ).group_by(
        func.date(AttendanceLog.timestamp),
        AttendanceLog.late
    )
    result = await db.execute(query)
    rows = result.all()

    stats_by_date = {}
    for r in rows:
        d_str = str(r.date)
        if d_str not in stats_by_date:
            stats_by_date[d_str] = {"present": 0, "late": 0}
        if r.late:
            stats_by_date[d_str]["late"] += r.count
            stats_by_date[d_str]["present"] += r.count
        else:
            stats_by_date[d_str]["present"] += r.count

    weekly = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        d_str = str(day)
        data = stats_by_date.get(d_str, {"present": 0, "late": 0})
        weekly.append({
            "day": day.strftime("%a %d/%m"),
            "present": data["present"],
            "late": data["late"],
        })

    return weekly


@router.get("/monthly")
async def get_monthly_stats(
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """Get monthly attendance statistics using indexed timestamp range."""
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
    start_dt = datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc)
    
    query = select(
        func.date(AttendanceLog.timestamp).label("date"),
        AttendanceLog.late,
        func.count(func.distinct(AttendanceLog.user_id)).label("count")
    ).where(
        AttendanceLog.timestamp >= start_dt,
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
    """Get unified recent activities fast via lightweight joins without heavy ORM object hydration."""
    att_query = (
        select(
            AttendanceLog.id,
            AttendanceLog.event_type,
            AttendanceLog.timestamp,
            AttendanceLog.late,
            User.full_name.label("user_name")
        )
        .outerjoin(User, AttendanceLog.user_id == User.id)
        .order_by(AttendanceLog.timestamp.desc())
        .limit(limit)
    )
    att_result = await db.execute(att_query)
    attendance_rows = att_result.all()
    
    act_query = (
        select(
            ActivityLog.id,
            ActivityLog.action,
            ActivityLog.created_at,
            Admin.full_name.label("admin_name")
        )
        .outerjoin(Admin, ActivityLog.admin_id == Admin.id)
        .order_by(ActivityLog.created_at.desc())
        .limit(limit)
    )
    act_result = await db.execute(act_query)
    activity_rows = act_result.all()
    
    unified = []
    for row in attendance_rows:
        unified.append({
            "id": f"att-{row.id}",
            "user_name": row.user_name or "Unknown",
            "event_type": row.event_type,
            "timestamp": row.timestamp.isoformat() if row.timestamp else None,
            "late": row.late,
            "category": "ATTENDANCE"
        })
        
    for row in activity_rows:
        unified.append({
            "id": f"act-{row.id}",
            "user_name": row.admin_name or "Administrator",
            "event_type": row.action,
            "timestamp": row.created_at.isoformat() if row.created_at else None,
            "late": False,
            "category": "ADMIN"
        })
        
    unified = [u for u in unified if u["timestamp"] is not None]
    unified.sort(key=lambda x: x["timestamp"], reverse=True)
    
    return {"items": unified[:limit]}


@router.get("/summary")
async def get_dashboard_summary(
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin),
):
    """Ultra-fast all-in-one summary endpoint combining stats, weekly, monthly, and recent activities."""
    stats = await get_stats(db, admin)
    weekly = await get_weekly_stats(db, admin)
    monthly = await get_monthly_stats(db, admin)
    activities = await get_recent_activities(10, db, admin)
    return {
        "stats": stats,
        "weekly": weekly,
        "monthly": monthly,
        "activities": activities.get("items", [])
    }
