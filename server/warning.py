import sqlite3
import os
import io
import shutil
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel
from PIL import Image, UnidentifiedImageError

from db import get_db


router = APIRouter(prefix="/warning", tags=["warning"])


class RequestAddWarningPlace(BaseModel):
    name: str
    latitude: float
    longitude: float
    description: str


class RequestListWarningPlace(BaseModel):
    origin_latitude: float
    origin_longitude: float
    destination_latitude: float
    destination_longitude: float


@router.post("/add_place")
def add_warning_place(
    place: RequestAddWarningPlace,
    db: sqlite3.Connection = Depends(get_db),
) -> dict:
    try:
        cursor = db.execute(
            "INSERT INTO warning_places (name, latitude, longitude, description) VALUES (?, ?, ?, ?)",
            (place.name, place.latitude, place.longitude, place.description),
        )
        return {"message": "Warning place added successfully", "id": cursor.lastrowid}
    except sqlite3.OperationalError:
        raise HTTPException(status_code=500, detail="Database operational error")
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to add warning place")


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
            "SELECT * FROM warning_places WHERE latitude <= ? AND latitude >= ? AND longitude <= ? AND longitude >= ?",
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
            "SELECT * FROM warning_places WHERE id = ?",
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
) -> dict:
    try:
        if image.content_type != "image/png":
            raise HTTPException(status_code=415, detail="PNG만 업로드 가능합니다 (content-type).")

        if not (image.filename or "").lower().endswith(".png"):
            raise HTTPException(status_code=415, detail="PNG만 업로드 가능합니다 (확장자).")

        data = await image.read()
        img = Image.open(io.BytesIO(data))
        img.verify()

        WARNING_PLACE_IMG_PATH.mkdir(parents=True, exist_ok=True)

        filename = f"{place_id}.png"
        save_path = WARNING_PLACE_IMG_PATH / filename

        with save_path.open("wb") as f:
            f.write(data)

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
