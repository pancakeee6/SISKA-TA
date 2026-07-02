import asyncio
from sqlalchemy import select
from app.db.database import async_session
from app.models.admin import Admin
from app.core.security import get_password_hash
from app.core.config import settings

async def reset_pw():
    username = settings.ML_ADMIN_USERNAME or "admin"
    password = settings.ML_ADMIN_PASSWORD or "admin"
    
    async with async_session() as session:
        result = await session.execute(select(Admin).where(Admin.username == username))
        admin = result.scalar_one_or_none()
        if admin:
            admin.password_hash = get_password_hash(password)
            await session.commit()
            print(f"[OK] Password admin '{username}' berhasil direset menjadi '{password}'")
        else:
            admin = Admin(
                username=username,
                email="admin@siska.com",
                password_hash=get_password_hash(password),
                full_name="Administrator",
            )
            session.add(admin)
            await session.commit()
            print(f"[OK] Akun admin '{username}' baru dibuat dengan password '{password}'")

if __name__ == "__main__":
    asyncio.run(reset_pw())
