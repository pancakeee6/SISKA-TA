from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.core.config import settings

db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif db_url.startswith("postgresql://") and "+asyncpg" not in db_url:
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

if "sslmode=" in db_url:
    db_url = db_url.replace("sslmode=", "ssl=")
if "ssl-mode=" in db_url:
    db_url = db_url.replace("ssl-mode=", "ssl=")

engine_kwargs = {
    "echo": settings.DEBUG,
}

if "sqlite" not in db_url:
    # Use NullPool for cloud PostgreSQL (Aiven) on Windows uvicorn reload.
    # Every request checks out a fresh connection and closes the socket immediately upon yield completion.
    # This prevents orphaned pooled sockets and connection quota exhaustion (`max_connections`) on cloud servers.
    engine_kwargs["poolclass"] = NullPool

engine = create_async_engine(db_url, **engine_kwargs)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


# Ensure all models are imported and registered with Base.metadata before any session checks out
import app.models  # noqa: F401


async def get_db():
    """Dependency: yield async database session."""
    async with async_session() as session:
        try:
            yield session
            if session.is_active:
                await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
