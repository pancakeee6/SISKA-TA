import asyncio
import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# Initialize environment for standalone script
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.db.database import async_session
from app.models.user import User
from app.models.face import FaceData
from app.models.attendance import AttendanceLog
from app.services import ai_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def main():
    logger.info("Memulai sinkronisasi data dari ML API ke Database Lokal...")
    
    # 1. Fetch from ML API
    try:
        ml_persons = await ai_service.list_persons()
        logger.info(f"Ditemukan {len(ml_persons)} data pengguna di ML API.")
    except Exception as e:
        logger.error(f"Gagal mengambil data dari ML API: {e}")
        return

    # 2. Compare and sync
    added_count = 0
    skipped_count = 0

    async with async_session() as db:
        for person in ml_persons:
            ml_person_id = person.get("id") or person.get("person_id")
            person_name = person.get("name", "Unknown")
            
            # Check if this ml_person_id already exists in Postgres
            result = await db.execute(
                select(User).where(User.ml_person_id == ml_person_id)
            )
            existing_user = result.scalar_one_or_none()

            if existing_user:
                skipped_count += 1
                logger.info(f"Skip: {person_name} (ID: {ml_person_id}) sudah tersinkron.")
            else:
                # Need to check if the name matches to prevent duplicate name issues 
                # (but since we sync by ml_person_id, we just create a new one if ID doesn't exist, 
                # or maybe just fallback to name match if we want to be safe)
                # We'll create a new one.
                new_user = User(
                    full_name=person_name,
                    employee_id=f"SYNC-{ml_person_id}", # placeholder NIK
                    email=f"user_{ml_person_id}@siska.local", # placeholder email
                    department="Unassigned",
                    ml_person_id=ml_person_id,
                    is_active=True
                )
                db.add(new_user)
                added_count += 1
                logger.info(f"Added: {person_name} (ID: {ml_person_id}) disinkronisasi ke DB lokal.")

        # Commit changes
        if added_count > 0:
            await db.commit()
            
    logger.info(f"Sinkronisasi Selesai! Berhasil menambahkan {added_count} pengguna baru. Melewati {skipped_count} pengguna yang sudah ada.")

if __name__ == "__main__":
    asyncio.run(main())
