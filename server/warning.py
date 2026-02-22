import sqlite3
import os
import io
from datetime import date, timedelta
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel
from PIL import Image, UnidentifiedImageError

from db import get_db


router = APIRouter(prefix="/warning", tags=["warning"])


PlaceType = Literal["Stuff", "Stair", "EV"]


class RequestAddWarningPlace(BaseModel):
    user_id: int
    name: str
    latitude: float
    longitude: float
    description: str
    type: PlaceType = "Stuff"


class RequestListWarningPlace(BaseModel):
    origin_latitude: float
    origin_longitude: float
    destination_latitude: float
    destination_longitude: float


class RequestVerifyPlace(BaseModel):
    user_id: int
    is_valid: bool


class RequestViewport(BaseModel):
    sw_latitude: float
    sw_longitude: float
    ne_latitude: float
    ne_longitude: float
    type: PlaceType | None = None


def _update_consecutive_days(db: sqlite3.Connection, user_id: int) -> None:
    today = date.today().isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()

    user = db.execute(
        "SELECT last_report_date, consecutive_days FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()

    if user is None:
        return

    last_date = user["last_report_date"]
    consecutive = user["consecutive_days"] or 0

    if last_date == today:
        return
    elif last_date == yesterday:
        consecutive += 1
    else:
        consecutive = 1

    db.execute(
        "UPDATE users SET consecutive_days = ?, last_report_date = ? WHERE id = ?",
        (consecutive, today, user_id),
    )


@router.post("/add_place")
def add_warning_place(
    place: RequestAddWarningPlace,
    db: sqlite3.Connection = Depends(get_db),
) -> dict:
    try:
        cursor = db.execute(
            """INSERT INTO warning_places
               (user_id, name, latitude, longitude, description, type)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (place.user_id, place.name, place.latitude, place.longitude, place.description, place.type),
        )
        place_id = cursor.lastrowid

        db.execute(
            "UPDATE users SET obstacles_reported = obstacles_reported + 1 WHERE id = ?",
            (place.user_id,),
        )

        if place.type == "Stair":
            db.execute(
                "UPDATE users SET stairs_reported = stairs_reported + 1 WHERE id = ?",
                (place.user_id,),
            )
        elif place.type == "EV":
            db.execute(
                "UPDATE users SET elevators_reported = elevators_reported + 1 WHERE id = ?",
                (place.user_id,),
            )

        _update_consecutive_days(db, place.user_id)

        return {"message": "Warning place added successfully", "id": place_id}
    except sqlite3.OperationalError as e:
        print(f"[DB Error] add_place: {e}")
        raise HTTPException(status_code=500, detail=f"Database operational error: {e}")
    except Exception as e:
        print(f"[Error] add_place: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to add warning place: {e}")


@router.post("/viewport")
def get_places_in_viewport(
    viewport: RequestViewport,
    db: sqlite3.Connection = Depends(get_db),
) -> dict:
    try:
        if viewport.type:
            rows = db.execute(
                """SELECT id, latitude, longitude, type
                   FROM warning_places
                   WHERE latitude >= ? AND latitude <= ? AND longitude >= ? AND longitude <= ? AND type = ?""",
                (viewport.sw_latitude, viewport.ne_latitude, viewport.sw_longitude, viewport.ne_longitude, viewport.type),
            ).fetchall()
        else:
            rows = db.execute(
                """SELECT id, latitude, longitude, type
                   FROM warning_places
                   WHERE latitude >= ? AND latitude <= ? AND longitude >= ? AND longitude <= ?""",
                (viewport.sw_latitude, viewport.ne_latitude, viewport.sw_longitude, viewport.ne_longitude),
            ).fetchall()

        grouped: dict[tuple[float, float, str], list[int]] = {}
        for row in rows:
            key = (row["latitude"], row["longitude"], row["type"])
            if key not in grouped:
                grouped[key] = []
            grouped[key].append(row["id"])

        places = [
            {
                "latitude": lat,
                "longitude": lng,
                "type": place_type,
                "ids": ids,
            }
            for (lat, lng, place_type), ids in grouped.items()
        ]

        stats = {
            "total": len(rows),
            "Stuff": sum(1 for r in rows if r["type"] == "Stuff"),
            "Stair": sum(1 for r in rows if r["type"] == "Stair"),
            "EV": sum(1 for r in rows if r["type"] == "EV"),
        }

        return {
            "message": "Places retrieved successfully",
            "stats": stats,
            "places": places,
        }
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to get places in viewport")


@router.post("/get_place/")
def get_warning_places(
    place: RequestListWarningPlace,
    db: sqlite3.Connection = Depends(get_db),
) -> dict:
    max_latitude = max(place.origin_latitude, place.destination_latitude) + 0.001
    min_latitude = min(place.origin_latitude, place.destination_latitude) - 0.001
    max_longitude = max(place.origin_longitude, place.destination_longitude) + 0.001
    min_longitude = min(place.origin_longitude, place.destination_longitude) - 0.001

    try:
        rows = db.execute(
            """SELECT id, user_id, name, latitude, longitude, description, type, has_image, verification_count, created_at, updated_at
               FROM warning_places
               WHERE latitude <= ? AND latitude >= ? AND longitude <= ? AND longitude >= ?""",
            (max_latitude, min_latitude, max_longitude, min_longitude),
        ).fetchall()

        result_list = [dict(row) for row in rows]
        return {"message": "Warning places fetched successfully", "list": result_list}
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to get warning places")


@router.get("/get_place/{place_id}")
def get_warning_place_by_id(
    place_id: int,
    db: sqlite3.Connection = Depends(get_db),
) -> dict:
    try:
        row = db.execute(
            """SELECT id, user_id, name, latitude, longitude, description, type, has_image, verification_count, created_at, updated_at
               FROM warning_places WHERE id = ?""",
            (place_id,),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail="Warning place not found")

        return {"message": "Warning place retrieved successfully", "place": dict(row)}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to get warning place")


WARNING_PLACE_IMG_PATH = Path(os.getenv("WARNING_PLACE_IMG_PATH", "./warning_place_img"))


@router.post("/update_place_img/{place_id}")
async def update_warning_place_img(
    place_id: int,
    image: UploadFile = File(...),
    db: sqlite3.Connection = Depends(get_db),
) -> dict:
    try:
        if image.content_type != "image/png":
            raise HTTPException(status_code=415, detail="PNG만 업로드 가능합니다 (content-type).")

        if not (image.filename or "").lower().endswith(".png"):
            raise HTTPException(status_code=415, detail="PNG만 업로드 가능합니다 (확장자).")

        row = db.execute(
            "SELECT user_id FROM warning_places WHERE id = ?",
            (place_id,),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail="Warning place not found")

        user_id = row["user_id"]

        data = await image.read()
        img = Image.open(io.BytesIO(data))
        img.verify()

        WARNING_PLACE_IMG_PATH.mkdir(parents=True, exist_ok=True)

        filename = f"{place_id}.png"
        save_path = WARNING_PLACE_IMG_PATH / filename

        with save_path.open("wb") as f:
            f.write(data)

        db.execute(
            "UPDATE warning_places SET has_image = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (place_id,),
        )

        db.execute(
            "UPDATE users SET photos_uploaded = photos_uploaded + 1 WHERE id = ?",
            (user_id,),
        )

        return {"message": "Warning place image updated successfully"}
    except HTTPException:
        raise
    except UnidentifiedImageError:
        raise HTTPException(status_code=400, detail="Invalid image format")
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to update warning place image")


@router.get("/get_place_img/{place_id}")
def get_warning_place_img(place_id: int):
    try:
        path = WARNING_PLACE_IMG_PATH / f"{place_id}.png"
        if not path.is_file():
            raise HTTPException(status_code=404, detail="Warning place image not found")
        return FileResponse(path, media_type="image/png")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to get warning place image")


@router.post("/verify/{place_id}")
def verify_warning_place(
    place_id: int,
    req: RequestVerifyPlace,
    db: sqlite3.Connection = Depends(get_db),
) -> dict:
    try:
        place = db.execute(
            "SELECT id, user_id FROM warning_places WHERE id = ?",
            (place_id,),
        ).fetchone()

        if place is None:
            raise HTTPException(status_code=404, detail="Warning place not found")

        if place["user_id"] == req.user_id:
            raise HTTPException(status_code=400, detail="Cannot verify your own report")

        existing = db.execute(
            "SELECT id FROM verifications WHERE user_id = ? AND place_id = ?",
            (req.user_id, place_id),
        ).fetchone()

        if existing:
            raise HTTPException(status_code=400, detail="Already verified this place")

        db.execute(
            "INSERT INTO verifications (user_id, place_id, is_valid) VALUES (?, ?, ?)",
            (req.user_id, place_id, 1 if req.is_valid else 0),
        )

        if req.is_valid:
            db.execute(
                "UPDATE warning_places SET verification_count = verification_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (place_id,),
            )

        db.execute(
            "UPDATE users SET verifications = verifications + 1 WHERE id = ?",
            (req.user_id,),
        )

        return {
            "message": "Verification submitted successfully",
            "place_id": place_id,
            "is_valid": req.is_valid,
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to verify warning place")


@router.get("/verifications/{place_id}")
def get_place_verifications(
    place_id: int,
    db: sqlite3.Connection = Depends(get_db),
) -> dict:
    try:
        place = db.execute(
            "SELECT id, verification_count FROM warning_places WHERE id = ?",
            (place_id,),
        ).fetchone()

        if place is None:
            raise HTTPException(status_code=404, detail="Warning place not found")

        verifications = db.execute(
            """SELECT v.id, v.user_id, u.username, v.is_valid, v.created_at
               FROM verifications v
               JOIN users u ON v.user_id = u.id
               WHERE v.place_id = ?
               ORDER BY v.created_at DESC""",
            (place_id,),
        ).fetchall()

        return {
            "place_id": place_id,
            "verification_count": place["verification_count"],
            "verifications": [dict(v) for v in verifications],
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to get verifications")
