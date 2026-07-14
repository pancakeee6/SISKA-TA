from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone, timedelta
import logging

from app.db.database import get_db
from app.api.deps import get_current_admin
from app.models.attendance import AttendanceLog
from app.models.user import User
from app.models.shift import WorkShift
from app.schemas.attendance import AttendanceLogResponse, AttendanceListResponse
from app.services import ai_service
from app.core.websocket import ws_manager
from app.core.config import settings

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
            # ─── Evaluasi Shift, Waktu WIB, Toleransi 20 Menit, & Mencegah Duplikasi ───
            now_utc = datetime.now(timezone.utc)
            wib_tz = timezone(timedelta(hours=7))
            now_wib = now_utc.astimezone(wib_tz)
            today_date = now_wib.date()

            # Ambil semua WorkShift dari database atau gunakan default
            shift_result = await db.execute(select(WorkShift).order_by(WorkShift.start_time.asc()))
            shifts = shift_result.scalars().all()
            if not shifts:
                shifts = [
                    WorkShift(name="Shift 1 (Pagi/Siang)", start_time="08:00", end_time="15:00"),
                    WorkShift(name="Shift 2 (Sore/Malam)", start_time="15:00", end_time="21:00")
                ]

            # Tentukan shift mana yang aktif berdasarkan jam saat ini (WIB)
            active_shift = shifts[0]
            for s in shifts:
                try:
                    s_hour, s_min = map(int, s.start_time.split(":"))
                    if now_wib.time() >= datetime(2000, 1, 1, s_hour, s_min).time():
                        active_shift = s
                except Exception:
                    pass

            # Cari log kehadiran user hari ini (dalam rentang waktu WIB hari ini)
            start_of_day_wib = datetime.combine(today_date, datetime.min.time(), tzinfo=wib_tz)
            start_of_day_utc = start_of_day_wib.astimezone(timezone.utc)
            end_of_day_utc = start_of_day_utc + timedelta(days=1)

            existing_logs_result = await db.execute(
                select(AttendanceLog)
                .where(
                    AttendanceLog.user_id == user.id,
                    AttendanceLog.timestamp >= start_of_day_utc,
                    AttendanceLog.timestamp < end_of_day_utc
                )
                .order_by(AttendanceLog.timestamp.asc())
            )
            today_logs = existing_logs_result.scalars().all()

            in_logs = [l for l in today_logs if l.event_type == "IN"]
            out_logs = [l for l in today_logs if l.event_type == "OUT"]

            skip_log = False
            calculated_event_type = "IN"
            calculated_is_late = False
            status_text = "present"
            late_duration_str = None
            diff_minutes_late = None

            if not in_logs:
                # Absen pertama kali hari ini -> Masuk (IN)
                calculated_event_type = "IN"
                # Cek batas waktu toleransi 20 menit dari jam masuk active_shift
                try:
                    sh, sm = map(int, active_shift.start_time.split(":"))
                    shift_start_dt = now_wib.replace(hour=sh, minute=sm, second=0, microsecond=0)
                    late_threshold_dt = shift_start_dt + timedelta(minutes=20)
                    if now_wib > late_threshold_dt:
                        calculated_is_late = True
                        status_text = "late"
                        diff_minutes_late = int((now_wib - shift_start_dt).total_seconds() / 60.0)
                        if diff_minutes_late < 0:
                            diff_minutes_late = 0
                        hours = diff_minutes_late // 60
                        mins = diff_minutes_late % 60
                        if hours > 0 and mins > 0:
                            late_duration_str = f"{hours} jam {mins} menit"
                        elif hours > 0:
                            late_duration_str = f"{hours} jam"
                        else:
                            late_duration_str = f"{mins} menit" if mins > 0 else "1 menit"
                    else:
                        calculated_is_late = False
                        status_text = "present"
                except Exception:
                    calculated_is_late = bool(face.get("is_late", False))
                    status_text = "late" if calculated_is_late else "present"
            else:
                # Sudah pernah absen IN hari ini
                last_in_time = in_logs[-1].timestamp
                if last_in_time.tzinfo is None:
                    last_in_time = last_in_time.replace(tzinfo=timezone.utc)
                diff_minutes = (now_utc - last_in_time).total_seconds() / 60.0

                if not out_logs and diff_minutes < 15.0:
                    # Terlalu cepat setelah absen IN (kurang dari 15 menit), abaikan agar tidak duplikat
                    skip_log = True
                    calculated_event_type = "IN"
                    calculated_is_late = in_logs[0].late
                    status_text = "cooldown"
                elif not out_logs:
                    # Absen kedua kalinya hari ini (setelah > 15 menit) -> Pulang (OUT)
                    calculated_event_type = "OUT"
                    calculated_is_late = False
                    status_text = "present"
                else:
                    # Sudah pernah absen IN dan OUT hari ini -> Abaikan duplikat agar tidak bertabrakan
                    skip_log = True
                    calculated_event_type = "OUT"
                    calculated_is_late = False
                    status_text = "cooldown"

            if not skip_log:
                log = AttendanceLog(
                    user_id=user.id,
                    event_type=calculated_event_type,
                    status=status_text,
                    late=calculated_is_late,
                    device_id=settings.DEVICE_ID,
                )
                db.add(log)
                await db.commit()

                event_data = {
                    "type": "attendance_marked",
                    "data": {
                        "user_name": user.full_name,
                        "event_type": calculated_event_type,
                        "status": status_text,
                        "late": calculated_is_late,
                        "timestamp": now_utc.isoformat(),
                        "shift_label": active_shift.name,
                        "late_duration": late_duration_str,
                        "late_minutes": diff_minutes_late,
                    },
                }
                await ws_manager.broadcast(event_data)
            
            results.append({
                "user_name": user.full_name,
                "event_type": calculated_event_type,
                "status": "cooldown" if skip_log else "ok",
                "late": calculated_is_late,
                "audio_text": face.get("audio_text"),
                "bbox": face.get("bbox") or face.get("box") or face.get("location"),
                "shift_label": active_shift.name,
                "late_duration": late_duration_str,
                "late_minutes": diff_minutes_late,
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

    # Batch fetch all users in 1 query to prevent N+1 queries
    user_ids = {log.user_id for log in logs if log.user_id}
    user_map = {}
    if user_ids:
        users_result = await db.execute(
            select(User.id, User.full_name, User.employee_id).where(User.id.in_(user_ids))
        )
        for u_id, u_name, u_emp in users_result.all():
            user_map[u_id] = (u_name, u_emp)

    shift_result = await db.execute(select(WorkShift).order_by(WorkShift.start_time.asc()))
    shifts = shift_result.scalars().all()
    if not shifts:
        shifts = [
            WorkShift(name="Shift 1 (Pagi/Siang)", start_time="08:00", end_time="15:00"),
            WorkShift(name="Shift 2 (Sore/Malam)", start_time="15:00", end_time="21:00")
        ]
    wib_tz = timezone(timedelta(hours=7))

    log_responses = []
    for log in logs:
        user_name, employee_id = user_map.get(log.user_id, ("Unknown", "-"))
        resp = AttendanceLogResponse.model_validate(log)
        resp.user_name = user_name
        resp.employee_id = employee_id

        if log.timestamp:
            log_utc = log.timestamp if log.timestamp.tzinfo else log.timestamp.replace(tzinfo=timezone.utc)
            log_wib = log_utc.astimezone(wib_tz)
            active_shift = shifts[0]
            for s in shifts:
                try:
                    sh, sm = map(int, s.start_time.split(":"))
                    if log_wib.time() >= datetime(2000, 1, 1, sh, sm).time():
                        active_shift = s
                except Exception:
                    pass
            resp.shift_label = active_shift.name
            if log.late and log.event_type == "IN":
                try:
                    sh, sm = map(int, active_shift.start_time.split(":"))
                    shift_start_dt = log_wib.replace(hour=sh, minute=sm, second=0, microsecond=0)
                    diff_minutes = int((log_wib - shift_start_dt).total_seconds() / 60.0)
                    if diff_minutes < 0:
                        diff_minutes = 0
                    resp.late_minutes = diff_minutes
                    hours = diff_minutes // 60
                    mins = diff_minutes % 60
                    if hours > 0 and mins > 0:
                        resp.late_duration = f"{hours} jam {mins} menit"
                    elif hours > 0:
                        resp.late_duration = f"{hours} jam"
                    else:
                        resp.late_duration = f"{mins} menit" if mins > 0 else "1 menit"
                except Exception:
                    resp.late_duration = "-"

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

    # Batch fetch users in 1 query
    user_ids = {log.user_id for log in logs if log.user_id}
    user_map = {}
    if user_ids:
        users_result = await db.execute(
            select(User.id, User.full_name, User.employee_id).where(User.id.in_(user_ids))
        )
        for u_id, u_name, u_emp in users_result.all():
            user_map[u_id] = (u_name, u_emp)

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
        user_name, employee_id = user_map.get(log.user_id, ("Unknown", "-"))

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
