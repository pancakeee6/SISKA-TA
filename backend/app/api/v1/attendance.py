from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone

from app.db.database import get_db
from app.api.deps import get_current_admin
from app.models.attendance import AttendanceLog
from app.models.user import User
from app.schemas.attendance import AttendanceLogResponse, AttendanceListResponse
from app.services import ai_service
from app.core.websocket import ws_manager
from app.core.config import settings

router = APIRouter()


@router.post("/recognize")
async def recognize_attendance(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Receive face image, forward to AI API, log attendance."""
    try:
        # Forward to AI API
        ai_result = await ai_service.recognize_face(file)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI API error: {str(e)}")

    if ai_result.get("status") != "ok" or not ai_result.get("faces"):
        return {
            "status": "unrecognized",
            "message": "Wajah tidak dikenali",
            "faces": [],
        }

    # Process each recognized face
    results = []
    for face in ai_result["faces"]:
        # Find user by name
        user_result = await db.execute(
            select(User).where(User.full_name == face["name"], User.is_active == True)
        )
        user = user_result.scalar_one_or_none()

        if user:
            # Log attendance
            log = AttendanceLog(
                user_id=user.id,
                event_type=face.get("event_type", "IN"),
                status="late" if face.get("late") else "present",
                late=face.get("late", False),
                device_id=settings.DEVICE_ID,
            )
            db.add(log)
            await db.flush()

            event_data = {
                "type": "attendance_marked",
                "data": {
                    "user_name": user.full_name,
                    "event_type": face.get("event_type", "IN"),
                    "status": "late" if face.get("late") else "present",
                    "late": face.get("late", False),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            }

            # Broadcast to admin dashboard via WebSocket
            await ws_manager.broadcast(event_data)

            results.append(event_data["data"])

    return {
        "status": "recognized",
        "faces": results,
    }


@router.get("/logs", response_model=AttendanceListResponse)
async def attendance_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    date: str = Query(None, description="Filter by date (YYYY-MM-DD)"),
    search: str = Query(None),
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """Get attendance logs with pagination and filters."""
    query = select(AttendanceLog).join(User)

    # Date filter
    if date:
        try:
            filter_date = datetime.strptime(date, "%Y-%m-%d").date()
            query = query.where(func.date(AttendanceLog.timestamp) == filter_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Format tanggal harus YYYY-MM-DD")

    # Search by user name
    if search:
        query = query.where(User.full_name.ilike(f"%{search}%"))

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()

    # Paginate
    query = query.offset((page - 1) * per_page).limit(per_page).order_by(AttendanceLog.timestamp.desc())
    result = await db.execute(query)
    logs = result.scalars().all()

    # Map with user names
    log_responses = []
    for log in logs:
        user_result = await db.execute(select(User.full_name).where(User.id == log.user_id))
        user_name = user_result.scalar_one_or_none()
        resp = AttendanceLogResponse.model_validate(log)
        resp.user_name = user_name
        log_responses.append(resp)

    return AttendanceListResponse(
        logs=log_responses,
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/export")
async def export_attendance(
    date_from: str = Query(None),
    date_to: str = Query(None),
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """Export attendance data (placeholder - will return JSON for now)."""
    # TODO: Implement CSV/Excel export
    return {"message": "Export endpoint - CSV/Excel export to be implemented"}
