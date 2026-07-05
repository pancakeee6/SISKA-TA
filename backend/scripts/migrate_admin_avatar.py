import asyncio
import sys
import os

# Add the parent directory to sys.path so we can import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.db.database import engine

async def migrate():
    print("Starting migration...")
    async with engine.begin() as conn:
        try:
            # Add the avatar column as TEXT since it will store base64 strings
            await conn.execute(text("ALTER TABLE admins ADD COLUMN avatar TEXT;"))
            print("Successfully added 'avatar' column to 'admins' table.")
        except Exception as e:
            if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                print("Column 'avatar' already exists.")
            else:
                print(f"Error during migration: {e}")

if __name__ == "__main__":
    asyncio.run(migrate())
