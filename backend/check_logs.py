import asyncio
from app.db.database import async_session
from app.models.activity_log import ActivityLog
from sqlalchemy import select

async def main():
    async with async_session() as db:
        res = await db.execute(select(ActivityLog).order_by(ActivityLog.created_at.desc()))
        logs = res.scalars().all()
        print([{"id": l.id, "action": l.action, "target_id": str(l.target_id)} for l in logs])

if __name__ == "__main__":
    asyncio.run(main())
