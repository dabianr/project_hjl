import aiosqlite
from config import settings

DB_PATH = settings.DATABASE_PATH


async def get_db():
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    yield db
    await db.close()


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS operation_logs (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                file_hash   TEXT NOT NULL,
                file_name   TEXT NOT NULL,
                uploader    TEXT NOT NULL,
                ipfs_cid    TEXT NOT NULL,
                tx_hash     TEXT NOT NULL,
                block_number INTEGER,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.commit()
