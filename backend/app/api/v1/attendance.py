from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone
import logging

from app.db.database import get_db
from app.api.deps import get_current_admin
from app.models.attendance import AttendanceLog
from app.models.user import User
from app.schemas.attendance import AttendanceLogResponse, AttendanceListResponse
from app.services import ai_service
from app.core.sse import sse_manager
from app.core.config import settings
from app.services.settings_service import get_settings
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)

router = APIRouter()

# Threshold untuk filter confidence/distance dari AI
# Jika AI mengembalikan confidence < threshold, dianggap tidak yakin
MIN_CONFIDENCE = 0.6
MAX_DISTANCE = 0.7


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

    # ─── LOG RAW AI RESPONSE untuk debugging salah deteksi ───
    logger.info(f"[AI RAW RESPONSE] {ai_result}")

    if not ai_result.get("faces") or ai_result.get("status") in ("error", "failed", "unrecognized"):
        return {
            "status": "unrecognized",
            "message": "Wajah tidak dikenali",
            "faces": [],
        }

    # Process each recognized face
    results = []
    for face in ai_result["faces"]:
        # ─── Filter berdasarkan confidence/distance jika AI mengembalikannya ───
        confidence = face.get("confidence") or face.get("score") or face.get("similarity")
        distance = face.get("distance")
        
        if confidence is not None and float(confidence) < MIN_CONFIDENCE:
            logger.warning(f"[SKIP LOW CONFIDENCE] {face.get('name')} confidence={confidence} < {MIN_CONFIDENCE}")
            continue
        if distance is not None and float(distance) > MAX_DISTANCE:
            logger.warning(f"[SKIP HIGH DISTANCE] {face.get('name')} distance={distance} > {MAX_DISTANCE}")
            continue
        
        # Find user by ml_person_id first
        ml_person_id = face.get("id") or face.get("person_id")
        user = None
        
        if ml_person_id is not None:
            user_result = await db.execute(
                select(User).where(
                    User.ml_person_id == ml_person_id,
                    User.is_active == True
                )
            )
            user = user_result.scalars().first()
            
        # Fallback to name if ml_person_id not found or failed
        if not user:
            user_result = await db.execute(
                select(User).where(
                    func.lower(User.full_name) == func.lower(face.get("name", "")),
                    User.is_active == True
                )
            )
            user = user_result.scalars().first()

        if user:
            # Calculate is_late locally based on settings
            wib = ZoneInfo("Asia/Jakarta")
            now_local = datetime.now(wib)
            current_time_str = now_local.strftime("%H:%M")
            
            app_settings = get_settings()
            current_event = face.get("event_type") or "IN"
            is_late_local = False
            
            if current_event == "IN":
                if now_local.hour < 13:
                    if len(app_settings.shifts) > 0:
                        shift = app_settings.shifts[0]
                        if current_time_str > shift.start_time:
                            is_late_local = True
                else:
                    if len(app_settings.shifts) > 1:
                        shift = app_settings.shifts[1]
                        if current_time_str > shift.start_time:
                            is_late_local = True

            # Check how many times this user has scanned today for the same event type
            today = datetime.now(timezone.utc).date()
            scan_count_result = await db.execute(
                select(func.count(AttendanceLog.id)).where(
                    AttendanceLog.user_id == user.id,
                    AttendanceLog.event_type == current_event,
                    func.date(AttendanceLog.timestamp) == today
                )
            )
            scan_count = scan_count_result.scalar() or 0

            # Hanya rekam 1 data (scan pertama) per event_type (IN/OUT) per harinya
            if scan_count == 0:
                # Log attendance locally
                log = AttendanceLog(
                    user_id=user.id,
                    event_type=current_event,
                    status="late" if is_late_local else "present",
                    late=is_late_local,
                    device_id=settings.DEVICE_ID,
                )
                db.add(log)
                await db.flush()

                event_data = {
                    "type": "attendance_marked",
                    "data": {
                        "user_name": user.full_name,
                        "event_type": current_event,
                        "status": "late" if is_late_local else "present",
                        "late": is_late_local,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                }

                # Broadcast to admin dashboard via SSE
                await sse_manager.broadcast(event_data)
                
                frontend_status = "ok"
            else:
                logger.info(f"Skipping log and broadcast for {user.full_name} ({current_event}), already scanned {scan_count} times today.")
                frontend_status = "cooldown"
            
            # Append result for the frontend (controlled strictly by SISKA backend)
            results.append({
                "user_name": user.full_name,
                "event_type": current_event, # fallback for UI
                "status": frontend_status,
                "late": is_late_local if scan_count == 0 else False,
                "audio_text": face.get("audio_text"),
                "bbox": face.get("bbox") or face.get("box") or face.get("location"),
            })

    return {
        "status": "recognized",
        "faces": results,
    }


@router.get("/logs", response_model=AttendanceListResponse)
async def attendance_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    date: str = Query(None, description="Filter by date (YYYY-MM-DD)"),
    date_from: str = Query(None),
    date_to: str = Query(None),
    status: str = Query(None),
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

    # Date range filters
    if date_from:
        try:
            d_from = datetime.strptime(date_from, "%Y-%m-%d").date()
            query = query.where(func.date(AttendanceLog.timestamp) >= d_from)
        except ValueError:
            raise HTTPException(status_code=400, detail="Format date_from harus YYYY-MM-DD")

    if date_to:
        try:
            d_to = datetime.strptime(date_to, "%Y-%m-%d").date()
            query = query.where(func.date(AttendanceLog.timestamp) <= d_to)
        except ValueError:
            raise HTTPException(status_code=400, detail="Format date_to harus YYYY-MM-DD")

    # Status filter
    if status == "late":
        query = query.where(AttendanceLog.late == True)
    elif status == "present":
        query = query.where(AttendanceLog.late == False)

    # Search by user name or employee_id
    if search:
        query = query.where(User.full_name.ilike(f"%{search}%") | User.employee_id.ilike(f"%{search}%"))

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Paginate
    query = query.offset((page - 1) * per_page).limit(per_page).order_by(AttendanceLog.timestamp.desc())
    result = await db.execute(query)
    logs = result.scalars().all()

    # Map with user names and employee IDs
    log_responses = []
    for log in logs:
        user_result = await db.execute(
            select(User.full_name, User.employee_id).where(User.id == log.user_id)
        )
        user_row = user_result.one_or_none()
        user_name = user_row[0] if user_row else "Unknown"
        employee_id = user_row[1] if user_row else "-"

        resp = AttendanceLogResponse.model_validate(log)
        resp.user_name = user_name
        resp.employee_id = employee_id
        log_responses.append(resp)

    return AttendanceListResponse(
        logs=log_responses,
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/export")
async def export_attendance(
    date_from: str = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: str = Query(None, description="End date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """Export attendance data as CSV file."""
    import csv
    import io
    from fastapi.responses import StreamingResponse

    query = select(AttendanceLog).join(User).order_by(AttendanceLog.timestamp.desc())

    # Date range filter
    if date_from:
        try:
            d_from = datetime.strptime(date_from, "%Y-%m-%d").date()
            query = query.where(func.date(AttendanceLog.timestamp) >= d_from)
        except ValueError:
            raise HTTPException(status_code=400, detail="Format date_from harus YYYY-MM-DD")

    if date_to:
        try:
            d_to = datetime.strptime(date_to, "%Y-%m-%d").date()
            query = query.where(func.date(AttendanceLog.timestamp) <= d_to)
        except ValueError:
            raise HTTPException(status_code=400, detail="Format date_to harus YYYY-MM-DD")

    result = await db.execute(query)
    logs = result.scalars().all()

    # Build CSV in memory with UTF-8 BOM and semicolon delimiter for clean column separation in Excel
    output = io.StringIO()
    output.write('\ufeff')  # UTF-8 BOM for proper character encoding in Excel
    output.write('sep=;\r\n')  # Instruction for Excel to split columns by semicolon across all regions/locales
    writer = csv.writer(output, delimiter=';')

    # Header row
    writer.writerow([
        "No", "Nama Pegawai", "NIP / ID Pegawai", "Tipe Absensi", "Tanggal", "Jam / Waktu", "Status Kehadiran", "Keterangan Waktu", "ID Perangkat"
    ])

    for idx, log in enumerate(logs, 1):
        # Get user info
        user_result = await db.execute(
            select(User.full_name, User.employee_id).where(User.id == log.user_id)
        )
        user_row = user_result.one_or_none()
        user_name = user_row[0] if user_row else "Unknown"
        employee_id = user_row[1] if user_row else "-"

        # Readable labels
        tipe_absensi = "Check In (Masuk)" if log.event_type == "IN" else "Check Out (Keluar)"
        status_label = "Terlambat" if (log.late or log.status == "late") else (
            "Hadir" if log.event_type == "IN" else "Keluar"
        )
        keterangan_waktu = "Terlambat" if log.late else "Tepat Waktu"

        writer.writerow([
            idx,
            user_name,
            employee_id,
            tipe_absensi,
            log.timestamp.strftime("%Y-%m-%d"),
            log.timestamp.strftime("%H:%M:%S"),
            status_label,
            keterangan_waktu,
            log.device_id or "-",
        ])

    output.seek(0)

    # Generate filename with date range
    filename = "Laporan_Kehadiran_SISKA"
    if date_from:
        filename += f"_{date_from}"
    if date_to:
        filename += f"_sd_{date_to}"
    filename += ".csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )

@router.post("/reset")
async def reset_attendance_logs(
    db: AsyncSession = Depends(get_db),
):
    """Reset attendance logs (DEBUG ONLY)"""
    from sqlalchemy import delete
    # Clear local logs
    await db.execute(delete(AttendanceLog))
    await db.commit()
    
    # Forward to AI API
    try:
        await ai_service.reset_attendance()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI API error: {str(e)}")
        
    return {"status": "ok", "message": "Attendance logs reset"}
