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

    # Present, late, and dinas today in ONE single index scan query
    att_result = await db.execute(
        select(
            AttendanceLog.late,
            AttendanceLog.status,
            AttendanceLog.event_type,
            func.count(func.distinct(AttendanceLog.user_id))
        ).where(
            AttendanceLog.timestamp >= start_dt,
            AttendanceLog.timestamp <= end_dt,
            AttendanceLog.event_type.in_(["IN", "DINAS"]),
        ).group_by(AttendanceLog.late, AttendanceLog.status, AttendanceLog.event_type)
    )
    rows = att_result.all()
    on_time_count = 0
    late_count = 0
    dinas_count = 0
    for late_flag, status_val, event_val, count_val in rows:
        if status_val == "dinas" or event_val == "DINAS":
            dinas_count += count_val
        elif late_flag:
            late_count += count_val
        else:
            on_time_count += count_val
            
    present = on_time_count + late_count
    late = late_count
    dinas = dinas_count
    absent = max(0, total - present - dinas)

    return DashboardStats(
        total=total,
        present=present,
        late=late,
        dinas=dinas,
        absent=absent,
    )


@router.get("/weekly")
async def get_weekly_stats(
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """Get weekly attendance statistics using indexed timestamp range."""
    wib_tz = timezone(timedelta(hours=7))
    today = datetime.now(timezone.utc).astimezone(wib_tz).date()
    start_date = today - timedelta(days=6)
    start_dt = datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc)

    query = select(
        AttendanceLog.timestamp,
        AttendanceLog.late,
        AttendanceLog.status,
        AttendanceLog.event_type,
        AttendanceLog.user_id
    ).where(
        AttendanceLog.timestamp >= start_dt,
        AttendanceLog.event_type.in_(["IN", "DINAS"])
    )
    result = await db.execute(query)
    rows = result.all()

    wib_tz = timezone(timedelta(hours=7))
    stats_by_date = {}
    
    # Track unique users per day to avoid double counting
    daily_users = {}
    
    for r in rows:
        if not r.timestamp: continue
        dt_wib = r.timestamp.replace(tzinfo=timezone.utc).astimezone(wib_tz)
        d_str = str(dt_wib.date())
        
        if d_str not in stats_by_date:
            stats_by_date[d_str] = {"present": 0, "late": 0, "dinas": 0}
            daily_users[d_str] = set()
            
        if r.user_id in daily_users[d_str]:
            continue
        daily_users[d_str].add(r.user_id)
        
        if r.status == "dinas" or r.event_type == "DINAS":
            stats_by_date[d_str]["dinas"] += 1
        elif r.late:
            stats_by_date[d_str]["late"] += 1
            stats_by_date[d_str]["present"] += 1
        else:
            stats_by_date[d_str]["present"] += 1

    weekly = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        d_str = str(day)
        data = stats_by_date.get(d_str, {"present": 0, "late": 0, "dinas": 0})
        weekly.append({
            "day": day.strftime("%a %d/%m"),
            "present": data["present"],
            "late": data["late"],
            "dinas": data.get("dinas", 0),
        })

    return weekly


@router.get("/daily")
async def get_daily_stats(
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """Get hourly attendance statistics for today."""
    now_utc = datetime.now(timezone.utc)
    wib_tz = timezone(timedelta(hours=7))
    now_wib = now_utc.astimezone(wib_tz)
    today = now_wib.date()
    
    start_dt_wib = datetime.combine(today, datetime.min.time(), tzinfo=wib_tz)
    end_dt_wib = datetime.combine(today, datetime.max.time(), tzinfo=wib_tz)
    
    start_dt = start_dt_wib.astimezone(timezone.utc)
    end_dt = end_dt_wib.astimezone(timezone.utc)
    
    query = select(
        AttendanceLog.timestamp,
        AttendanceLog.late,
        AttendanceLog.status,
        AttendanceLog.event_type,
        AttendanceLog.user_id
    ).where(
        AttendanceLog.timestamp >= start_dt,
        AttendanceLog.timestamp <= end_dt,
        AttendanceLog.event_type.in_(["IN", "DINAS"])
    )
    result = await db.execute(query)
    rows = result.all()
    
    hourly_stats = {h: {"present": 0, "late": 0, "dinas": 0, "users": set()} for h in range(6, 18, 2)}
    
    for row in rows:
        if not row.timestamp: continue
        dt_wib = row.timestamp.replace(tzinfo=timezone.utc).astimezone(wib_tz)
        h = dt_wib.hour
        bucket_h = h if h % 2 == 0 else h - 1
        
        if bucket_h < 6: bucket_h = 6
        elif bucket_h > 16: bucket_h = 16
            
        if bucket_h not in hourly_stats:
            hourly_stats[bucket_h] = {"present": 0, "late": 0, "dinas": 0, "users": set()}
            
        if row.user_id in hourly_stats[bucket_h]["users"]:
            continue
        hourly_stats[bucket_h]["users"].add(row.user_id)
        
        if row.status == "dinas" or row.event_type == "DINAS":
            hourly_stats[bucket_h]["dinas"] += 1
        elif row.late:
            hourly_stats[bucket_h]["late"] += 1
            hourly_stats[bucket_h]["present"] += 1
        else:
            hourly_stats[bucket_h]["present"] += 1
            
    daily = []
    for h in sorted(hourly_stats.keys()):
        daily.append({
            "day": f"{h:02d}:00",
            "full_name": f"Jam {h:02d}:00",
            "present": hourly_stats[h]["present"],
            "late": hourly_stats[h]["late"],
            "dinas": hourly_stats[h]["dinas"]
        })
        
    return daily


@router.get("/monthly")
async def get_monthly_stats(
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """Get monthly attendance statistics using indexed timestamp range."""
    wib_tz = timezone(timedelta(hours=7))
    today = datetime.now(timezone.utc).astimezone(wib_tz).date()
    
    monthly = []
    for i in range(5, -1, -1):
        m = (today.month - i - 1) % 12 + 1
        y = today.year + ((today.month - i - 1) // 12)
        monthly.append({
            "year": y,
            "month": m,
            "present": 0,
            "late": 0,
            "dinas": 0,
        })
        
    start_date = datetime(monthly[0]["year"], monthly[0]["month"], 1).date()
    start_dt = datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc)
    
    query = select(
        AttendanceLog.timestamp,
        AttendanceLog.late,
        AttendanceLog.status,
        AttendanceLog.event_type,
        AttendanceLog.user_id
    ).where(
        AttendanceLog.timestamp >= start_dt,
        AttendanceLog.event_type.in_(["IN", "DINAS"])
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    wib_tz = timezone(timedelta(hours=7))
    monthly_users = {}
    
    for row in rows:
        if not row.timestamp: continue
        dt_wib = row.timestamp.replace(tzinfo=timezone.utc).astimezone(wib_tz)
        r_year = dt_wib.year
        r_month = dt_wib.month
        
        m_key = f"{r_year}-{r_month}"
        if m_key not in monthly_users:
            monthly_users[m_key] = set()
            
        # Optional: distinct users per month (though usually we count total attendance days in a month)
        # Let's count total attendance events (1 per day per user).
        # We need to deduplicate by user AND day for monthly stats
        day_key = f"{m_key}-{dt_wib.day}"
        user_day_key = f"{day_key}_{row.user_id}"
        if user_day_key in monthly_users[m_key]:
            continue
        monthly_users[m_key].add(user_day_key)
        
        for m in monthly:
            if m["year"] == r_year and m["month"] == r_month:
                if row.status == "dinas" or row.event_type == "DINAS":
                    m["dinas"] += 1
                elif row.late:
                    m["late"] += 1
                    m["present"] += 1
                else:
                    m["present"] += 1
                    
    output = []
    month_names = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"]
    for m in monthly:
        output.append({
            "day": month_names[m["month"] - 1],
            "full_name": f"{month_names[m['month'] - 1]} {m['year']}",
            "present": m["present"],
            "late": m["late"],
            "dinas": m.get("dinas", 0)
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
            AttendanceLog.status,
            AttendanceLog.device_id,
            AttendanceLog.timestamp,
            AttendanceLog.created_at,
            AttendanceLog.late,
            User.full_name.label("user_name")
        )
        .outerjoin(User, AttendanceLog.user_id == User.id)
        .order_by(AttendanceLog.created_at.desc())
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
            "status": row.status,
            "device_id": row.device_id,
            "timestamp": row.timestamp.isoformat() if row.timestamp else None,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "late": row.late,
            "category": "ATTENDANCE"
        })
        
    for row in activity_rows:
        unified.append({
            "id": f"act-{row.id}",
            "user_name": row.admin_name or "Administrator",
            "event_type": row.action,
            "timestamp": row.created_at.isoformat() if row.created_at else None,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "late": False,
            "category": "ADMIN"
        })
        
    unified = [u for u in unified if u["created_at"] is not None]
    unified.sort(key=lambda x: x["created_at"], reverse=True)
    
    return {"items": unified[:limit]}


@router.get("/summary")
async def get_dashboard_summary(
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin),
):
    """Ultra-fast all-in-one summary endpoint combining stats, weekly, monthly, and recent activities."""
    stats = await get_stats(db, admin)
    daily = await get_daily_stats(db, admin)
    weekly = await get_weekly_stats(db, admin)
    monthly = await get_monthly_stats(db, admin)
    activities = await get_recent_activities(10, db, admin)
    return {
        "stats": stats,
        "daily": daily,
        "weekly": weekly,
        "monthly": monthly,
        "activities": activities.get("items", [])
    }
