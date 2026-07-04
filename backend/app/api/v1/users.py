import logging
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.api.deps import get_current_admin
from app.models.user import User
from app.models.face import FaceData
from app.models.activity_log import ActivityLog
from app.schemas.user import UserCreate, UserUpdate, UserResponse, UserListResponse
from app.services import ai_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/")
async def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(None, ge=1, le=100),
    limit: int = Query(None, ge=1, le=100),
    search: str = Query(None),
    status: str = Query(None),
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """List all users with pagination and search."""
    # Accept both 'limit' and 'per_page' (frontend uses 'limit')
    actual_limit = limit or per_page or 20

    query = select(User).options(selectinload(User.face_data))

    # Apply status filter
    if status == "aktif":
        query = query.where(User.is_active == True)
    elif status == "nonaktif":
        query = query.where(User.is_active == False)

    # Search filter
    if search:
        query = query.where(
            User.full_name.ilike(f"%{search}%")
            | User.employee_id.ilike(f"%{search}%")
            | User.department.ilike(f"%{search}%")
        )

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Paginate
    query = query.offset((page - 1) * actual_limit).limit(actual_limit).order_by(User.created_at.desc())
    result = await db.execute(query)
    users = result.scalars().all()

    # Calculate global stats (for stats cards)
    total_users_res = await db.execute(select(func.count(User.id)))
    total_users = total_users_res.scalar() or 0

    active_users_res = await db.execute(select(func.count(User.id)).where(User.is_active == True))
    active_users = active_users_res.scalar() or 0

    inactive_users_res = await db.execute(select(func.count(User.id)).where(User.is_active == False))
    inactive_users = inactive_users_res.scalar() or 0

    face_users_res = await db.execute(select(func.count(func.distinct(FaceData.user_id))))
    has_face_users = face_users_res.scalar() or 0

    return {
        "items": [UserResponse.model_validate(u) for u in users],
        "total": total,
        "page": page,
        "per_page": actual_limit,
        "stats": {
            "total": total_users,
            "active": active_users,
            "inactive": inactive_users,
            "has_face": has_face_users,
        }
    }


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """Create a new user."""
    # Check duplicate employee_id
    existing = await db.execute(
        select(User).where(User.employee_id == data.employee_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Employee ID '{data.employee_id}' sudah terdaftar",
        )

    user = User(**data.model_dump())
    db.add(user)
    await db.flush()
    await db.refresh(user)

    # Sync to ML API — create person for face recognition
    try:
        ml_person_id = await ai_service.create_person(user.full_name)
        user.ml_person_id = ml_person_id
        await db.flush()
        logger.info(f"User '{user.full_name}' synced to ML API: person_id={ml_person_id}")
    except Exception as e:
        # Log warning but don't fail user creation
        logger.warning(f"ML API sync gagal untuk user '{user.full_name}': {e}")

    # Log Activity
    try:
        activity = ActivityLog(
            admin_id=_admin["id"],
            action="REGISTER",
            target_type="user",
            target_id=user.id,
            details={"employee_id": user.employee_id, "name": user.full_name}
        )
        db.add(activity)
        await db.commit() # commit all changes including user
    except Exception as e:
        logger.warning(f"Failed to log activity: {e}")
        await db.commit() # commit user even if activity log fails

    return UserResponse.model_validate(user)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """Get user detail by ID."""
    result = await db.execute(select(User).where(User.id == user_id).options(selectinload(User.face_data)))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")

    return UserResponse.model_validate(user)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """Update user data."""
    result = await db.execute(select(User).where(User.id == user_id).options(selectinload(User.face_data)))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")

    # Update only provided fields
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(user, key, value)

    await db.flush()
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.delete("/{user_id}")
async def delete_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """Soft delete user (set is_active = False)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")

    # Cleanup ML API person (best-effort)
    if user.ml_person_id:
        try:
            await ai_service.delete_person(user.ml_person_id)
        except Exception as e:
            logger.warning(f"ML API delete gagal untuk person_id={user.ml_person_id}: {e}")

    # Explicitly delete local face data since soft-delete doesn't trigger cascade
    from sqlalchemy import delete
    from app.models.face import FaceData
    await db.execute(delete(FaceData).where(FaceData.user_id == user_id))

    user.is_active = False
    # Append suffix to free up the employee_id for reuse
    user.employee_id = f"{user.employee_id}-del-{str(user.id)[:8]}"
    
    # Log Activity
    try:
        activity = ActivityLog(
            admin_id=_admin["id"],
            action="DELETE",
            target_type="user",
            target_id=user.id,
            details={"employee_id": user.employee_id, "name": user.full_name}
        )
        db.add(activity)
    except Exception as e:
        logger.warning(f"Failed to log delete activity: {e}")

    await db.commit()

    return {"message": f"User '{user.full_name}' berhasil dihapus"}
