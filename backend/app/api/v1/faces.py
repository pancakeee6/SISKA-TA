import logging
import os
import uuid as uuid_lib
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.api.deps import get_current_admin
from app.models.face import FaceData
from app.models.user import User
from app.services import ai_service
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/users/{user_id}/upload")
async def upload_face(
    user_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """Upload face image, enroll via ML API, store record in SISKA DB."""
    # Validate user exists
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")

    # Check user has ML person mapping
    if not user.ml_person_id:
        # Try to create person in ML API if not yet mapped
        try:
            ml_person_id = await ai_service.create_person(user.full_name)
            user.ml_person_id = ml_person_id
            await db.flush()
            logger.info(f"Auto-created ML person for '{user.full_name}': id={ml_person_id}")
        except Exception as e:
            raise HTTPException(
                status_code=502,
                detail=f"Gagal membuat person di ML API: {str(e)}. "
                       f"Pastikan ML API aktif dan user sudah tersinkron.",
            )

    # Validate file type
    if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
        raise HTTPException(status_code=400, detail="Format file harus JPEG, PNG, atau WebP")

    # Save image to disk
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    filename = f"{uuid_lib.uuid4()}{os.path.splitext(file.filename or '.jpg')[1]}"
    filepath = os.path.join(settings.UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        content = await file.read()
        f.write(content)

    # Reset file position for ML API
    await file.seek(0)

    # Enroll face via ML API (embedding managed by ML)
    try:
        await ai_service.enroll_face(user.ml_person_id, file)
    except Exception as e:
        # Clean up saved file on error
        if os.path.exists(filepath):
            os.remove(filepath)
        raise HTTPException(status_code=502, detail=f"ML API enrollment error: {str(e)}")

    # Save record in SISKA DB (without embedding — managed by ML API)
    face_data = FaceData(
        user_id=user_id,
        embedding_json=None,  # Embedding dikelola oleh ML API
        image_path=filepath,
    )
    db.add(face_data)
    await db.flush()
    await db.refresh(face_data)

    return {
        "id": str(face_data.id),
        "user_id": str(user_id),
        "image_path": filepath,
        "message": "Data wajah berhasil disimpan dan di-enroll ke ML API",
    }


@router.get("/users/{user_id}")
async def get_user_faces(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """Get all face data for a user."""
    result = await db.execute(
        select(FaceData).where(FaceData.user_id == user_id).order_by(FaceData.created_at.desc())
    )
    faces = result.scalars().all()

    return [
        {
            "id": str(f.id),
            "user_id": str(f.user_id),
            "image_path": f.image_path,
            "created_at": f.created_at.isoformat(),
        }
        for f in faces
    ]


@router.delete("/{face_id}")
async def delete_face(
    face_id: UUID,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """Delete face data."""
    result = await db.execute(select(FaceData).where(FaceData.id == face_id))
    face = result.scalar_one_or_none()

    if not face:
        raise HTTPException(status_code=404, detail="Data wajah tidak ditemukan")

    # Delete image file
    if face.image_path and os.path.exists(face.image_path):
        os.remove(face.image_path)

    await db.delete(face)
    await db.flush()

    return {"message": "Data wajah berhasil dihapus"}
