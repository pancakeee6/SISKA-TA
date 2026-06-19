import asyncio
import asyncpg

async def main():
    conn = await asyncpg.connect('postgresql://postgres:postgres@localhost:5432/postgres')
    rows = await conn.fetch("SELECT datname FROM pg_database WHERE datistemplate = false;")
    print("Databases:", [row['datname'] for row in rows])
    await conn.close()
    
    try:
        conn2 = await asyncpg.connect('postgresql://postgres:postgres@localhost:5432/siska')
        rows2 = await conn2.fetch("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")
        print("Tables in siska:", [row['table_name'] for row in rows2])
        await conn2.close()
    except Exception as e:
        print("Could not connect to siska:", e)

if __name__ == '__main__':
    asyncio.run(main())
