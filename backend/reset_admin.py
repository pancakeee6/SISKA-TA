import asyncio
from sqlalchemy import select
from app.db.database import async_session
from app.models.admin import Admin
from app.models.activity_log import ActivityLog
from app.models.attendance import AttendanceLog
from app.models.user import User
from app.models.face import FaceData
from app.core.security import get_password_hash

async def reset_pw():
    async with async_session() as session:
        result = await session.execute(select(Admin).where(Admin.username == "admin"))
        admin = result.scalar_one_or_none()
        if admin:
            admin.password_hash = get_password_hash("admin")
            await session.commit()
            print("Password admin berhasil direset menjadi 'admin'")
        else:
            print("User admin tidak ditemukan!")

if __name__ == "__main__":
    asyncio.run(reset_pw())
