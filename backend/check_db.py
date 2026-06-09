import asyncio
import asyncpg

async def main():
    conn = await asyncpg.connect('postgresql://postgres:root@localhost:5432/siska')
    rows = await conn.fetch("SELECT table_name FROM information_schema.tables WHERE table_schema='public';")
    for row in rows:
        print(row['table_name'])
    await conn.close()

asyncio.run(main())
