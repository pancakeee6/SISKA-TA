"""
Seed script: Create initial admin account.
Run with: python -m app.db.seed
"""
import asyncio
from sqlalchemy import select

from app.db.database import async_session, engine, Base
from app.models.admin import Admin
from app.models.user import User
from app.models.face import FaceData
from app.models.attendance import AttendanceLog
from app.models.activity_log import ActivityLog
from app.core.security import get_password_hash
from app.core.config import settings


async def seed():
    # Create tables if not exists
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    username = settings.ML_ADMIN_USERNAME or "admin"
    password = settings.ML_ADMIN_PASSWORD or "admin"

    async with async_session() as session:
        # Check if admin already exists
        result = await session.execute(
            select(Admin).where(Admin.username == username)
        )
        existing = result.scalar_one_or_none()

        if existing:
            existing.password_hash = get_password_hash(password)
            await session.commit()
            print(f"[OK] Password untuk admin '{username}' berhasil diperbarui menjadi '{password}'.")
            return

        # Create default admin
        admin = Admin(
            username=username,
            email="admin@siska.com",
            password_hash=get_password_hash(password),
            full_name="Administrator",
        )
        session.add(admin)
        await session.commit()
        print("[OK] Default admin created:")
        print(f"   Username: {username}")
        print(f"   Password: {password}")
        print("   [!] Change this password in production!")


if __name__ == "__main__":
    asyncio.run(seed())
