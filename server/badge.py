import sqlite3
from typing import Callable

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from db import get_db


router = APIRouter(prefix="/badge", tags=["badge"])


class Badge:
    def __init__(self, name: str, condition: Callable[[sqlite3.Row], bool]):
        self.name = name
        self.condition = condition

    def check(self, user: sqlite3.Row) -> bool:
        return self.condition(user)


BADGES = [
    Badge("First Reporter", lambda u: u["obstacles_reported"] >= 1),
    Badge("Explorer", lambda u: u["obstacles_reported"] >= 10),
    Badge("Photo Contributor", lambda u: u["photos_uploaded"] >= 5),
    Badge("Guardian", lambda u: u["verifications"] >= 10),
]


def evaluate_badges(user: sqlite3.Row, db: sqlite3.Connection) -> list[str]:
    user_id = user["id"]
    earned = []

    existing = db.execute(
        "SELECT badge_name FROM user_badges WHERE user_id = ?",
        (user_id,),
    ).fetchall()
    existing_names = {row["badge_name"] for row in existing}

    for badge in BADGES:
        if badge.name not in existing_names and badge.check(user):
            db.execute(
                "INSERT INTO user_badges (user_id, badge_name) VALUES (?, ?)",
                (user_id, badge.name),
            )
            earned.append(badge.name)

    return earned


class RequestCreateUser(BaseModel):
    username: str


@router.post("/user")
def create_user(
    req: RequestCreateUser,
    db: sqlite3.Connection = Depends(get_db),
) -> dict:
    try:
        cursor = db.execute(
            "INSERT INTO users (username) VALUES (?)",
            (req.username,),
        )
        return {"message": "User created successfully", "id": cursor.lastrowid}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Username already exists")
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to create user")


@router.get("/user/{user_id}")
def get_user(
    user_id: int,
    db: sqlite3.Connection = Depends(get_db),
) -> dict:
    try:
        user = db.execute(
            "SELECT * FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()

        if user is None:
            raise HTTPException(status_code=404, detail="User not found")

        badges = db.execute(
            "SELECT badge_name, earned_at FROM user_badges WHERE user_id = ?",
            (user_id,),
        ).fetchall()

        return {
            "user": dict(user),
            "badges": [dict(b) for b in badges],
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to get user")


@router.post("/user/{user_id}/evaluate")
def evaluate_user_badges(
    user_id: int,
    db: sqlite3.Connection = Depends(get_db),
) -> dict:
    try:
        user = db.execute(
            "SELECT * FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()

        if user is None:
            raise HTTPException(status_code=404, detail="User not found")

        new_badges = evaluate_badges(user, db)

        all_badges = db.execute(
            "SELECT badge_name, earned_at FROM user_badges WHERE user_id = ?",
            (user_id,),
        ).fetchall()

        return {
            "new_badges": new_badges,
            "all_badges": [dict(b) for b in all_badges],
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to evaluate badges")
