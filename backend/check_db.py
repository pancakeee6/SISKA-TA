import asyncio
from app.db.database import engine
from sqlalchemy import text

async def main():
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public';"))
        tables = [row[0] for row in result.fetchall()]
        print("Tabel di Aiven PostgreSQL:", tables)

asyncio.run(main())
