import aiosqlite
from pathlib import Path

from tadpole_studio.config import settings
from tadpole_studio.db.schema import SCHEMA_SQL, DEFAULT_SETTINGS


_db: aiosqlite.Connection | None = None


async def get_db() -> aiosqlite.Connection:
    global _db
    if _db is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    return _db


async def init_db() -> None:
    global _db
    settings.ensure_dirs()
    _db = await aiosqlite.connect(str(settings.DB_PATH))
    _db.row_factory = aiosqlite.Row
    await _db.execute("PRAGMA journal_mode=WAL")
    await _db.execute("PRAGMA foreign_keys=ON")
    await _db.execute("PRAGMA synchronous=NORMAL")
    await _db.execute("PRAGMA cache_size=-32000")
    await _db.execute("PRAGMA temp_store=MEMORY")
    await _db.execute("PRAGMA mmap_size=268435456")
    await _db.execute("PRAGMA busy_timeout=5000")
    await _db.executescript(SCHEMA_SQL)

    # Migrations for existing databases
    try:
        await _db.execute("ALTER TABLE generation_history ADD COLUMN title TEXT")
    except Exception:
        pass  # Column already exists

    try:
        await _db.execute("ALTER TABLE playlists ADD COLUMN icon TEXT DEFAULT 'ListMusic'")
    except Exception:
        pass  # Column already exists

    try:
        await _db.execute("ALTER TABLE generation_history ADD COLUMN backend TEXT DEFAULT 'ace-step'")
    except Exception:
        pass  # Column already exists

    # Seed default settings
    for key, value in DEFAULT_SETTINGS.items():
        await _db.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
            (key, value),
        )
    await _db.commit()


async def close_db() -> None:
    global _db
    if _db is not None:
        await _db.close()
        _db = None
