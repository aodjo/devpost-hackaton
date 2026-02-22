import os
import sqlite3
from typing import Generator

DB_PATH = os.getenv("DB_PATH", "app.db")


def init_db() -> None:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE,
                google_id TEXT UNIQUE,
                profile_image TEXT,
                obstacles_reported INTEGER DEFAULT 0,
                photos_uploaded INTEGER DEFAULT 0,
                verifications INTEGER DEFAULT 0,
                stairs_reported INTEGER DEFAULT 0,
                elevators_reported INTEGER DEFAULT 0,
                consecutive_days INTEGER DEFAULT 0,
                last_report_date TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS warning_places (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER REFERENCES users(id),
                name TEXT NOT NULL,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                description TEXT NOT NULL,
                type TEXT DEFAULT 'obstacle',
                has_image INTEGER DEFAULT 0,
                verification_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_warning_places_coords
                ON warning_places(latitude, longitude);

            CREATE TABLE IF NOT EXISTS verifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER REFERENCES users(id),
                place_id INTEGER REFERENCES warning_places(id),
                is_valid INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, place_id)
            );

            CREATE TABLE IF NOT EXISTS user_badges (
                user_id INTEGER REFERENCES users(id),
                badge_name TEXT NOT NULL,
                earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, badge_name)
            );
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
