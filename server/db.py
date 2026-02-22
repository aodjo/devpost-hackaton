import os
import sqlite3
from typing import Generator

DB_PATH = os.getenv("DB_PATH", "app.db")

def init_db() -> None:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS warning_places (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                description TEXT NOT NULL
            )
        """)
        conn.commit()
    finally:
        conn.close()

def get_db() -> Generator[sqlite3.Connection, None, None]:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()