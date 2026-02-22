import sqlite3
from datetime import datetime, timedelta
from typing import Callable

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from db import get_db


router = APIRouter(prefix="/badge", tags=["badge"])


BADGE_INFO = {
    "첫 발걸음": "OpenRoute에 오신 것을 환영해요!",
    "눈 밝은 시민": "첫 접근성 정보를 제보했어요",
    "불꽃 튀는 루틴": "7일 연속으로 제보를 이어갔어요",
    "길잡이": "제보 10회를 달성했어요",
    "오늘은 내가 거리의 수호자": "제보 30회를 달성했어요",
    "계단 스카우트": "첫 계단 정보를 등록했어요",
    "든든한 동행자": "1년간 접근성 정보를 등록했어요",
    "엘리베이터 가이드": "첫 엘레베이터 정보를 등록했어요",
}


class Badge:
    def __init__(self, name: str, description: str, condition: Callable[[sqlite3.Row], bool]):
        self.name = name
        self.description = description
        self.condition = condition

    def check(self, user: sqlite3.Row) -> bool:
        return self.condition(user)


def _check_one_year(user: sqlite3.Row) -> bool:
    created_at = user["created_at"]
    if not created_at:
        return False
    try:
        created = datetime.fromisoformat(created_at.replace(" ", "T"))
        return datetime.now() - created >= timedelta(days=365)
    except (ValueError, AttributeError):
        return False


BADGES = [
    Badge("첫 발걸음", BADGE_INFO["첫 발걸음"], lambda u: True),
    Badge("눈 밝은 시민", BADGE_INFO["눈 밝은 시민"], lambda u: u["obstacles_reported"] >= 1),
    Badge("불꽃 튀는 루틴", BADGE_INFO["불꽃 튀는 루틴"], lambda u: u["consecutive_days"] >= 7),
    Badge("길잡이", BADGE_INFO["길잡이"], lambda u: u["obstacles_reported"] >= 10),
    Badge("오늘은 내가 거리의 수호자", BADGE_INFO["오늘은 내가 거리의 수호자"], lambda u: u["obstacles_reported"] >= 30),
    Badge("계단 스카우트", BADGE_INFO["계단 스카우트"], lambda u: u["stairs_reported"] >= 1),
    Badge("든든한 동행자", BADGE_INFO["든든한 동행자"], _check_one_year),
    Badge("엘리베이터 가이드", BADGE_INFO["엘리베이터 가이드"], lambda u: u["elevators_reported"] >= 1),
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


@router.get("/list")
def list_badges() -> dict:
    return {
        "badges": [
            {"name": badge.name, "description": badge.description}
            for badge in BADGES
        ]
    }


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
        user_id = cursor.lastrowid

        db.execute(
            "INSERT INTO user_badges (user_id, badge_name) VALUES (?, ?)",
            (user_id, "첫 발걸음"),
        )

        return {
            "message": "User created successfully",
            "id": user_id,
            "badge": "첫 발걸음",
        }
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
