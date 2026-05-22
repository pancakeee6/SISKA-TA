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


async def seed():
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        # Check if admin already exists
        result = await session.execute(
            select(Admin).where(Admin.username == "admin")
        )
        existing = result.scalar_one_or_none()

        if existing:
            print("Admin 'admin' already exists. Skipping seed.")
            return

        # Create default admin
        admin = Admin(
            username="admin",
            email="admin@siska.com",
            password_hash=get_password_hash("admin123"),
            full_name="Administrator",
        )
        session.add(admin)
        await session.commit()
        print("[OK] Default admin created:")
        print("   Username: admin")
        print("   Password: admin123")
        print("   [!] Change this password in production!")


if __name__ == "__main__":
    asyncio.run(seed())
