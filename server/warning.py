import sqlite3
from typing import List
from db import get_db
from fastapi import HTTPException
from narwhals import List
import json

class request_WarningPlace(BaseModel):
    name: str
    latitude: float
    longitude: float
    description: str


@app.post("/warning/add_place")
async def add_warning_place(
    place: request_WarningPlace,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> dict:
    try:
        db.execute(
            "INSERT INTO warning_places (name, latitude, longitude, description) VALUES (?, ?, ?, ?)",
            (place.name, place.latitude, place.longitude, place.description),
        )
        return {"message": "Warning place added successfully"}
    except type(db).OperationalError:
        raise HTTPException(status_code=500, detail="Database operational error")
    except:
        raise HTTPException(status_code=500, detail="Failed to add warning place")
    
@app.get("/warning/get_place/{origin_latitude}/{origin_longitude}/{endpoint_latitude}/{endpoint_longitude}")
async def get_warning_places(
    origin_latitude: float,
    origin_longitude: float,
    endpoint_latitude: float,
    endpoint_longitude: float,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> dict:
    max_latitiude = max(origin_latitude, endpoint_latitude) + 0.001
    min_latitude = min(origin_latitude, endpoint_latitude) - 0.001
    max_longitude = max(origin_longitude, endpoint_longitude) + 0.001
    min_longitude = min(origin_longitude, endpoint_longitude) - 0.001

    try:
        list = db.execute(
            "SELECT * from warning_place WHERE latitude <= ? AND latitude >= ? AND longitude <= ? AND longitude >= ?",
            (max_latitiude, min_latitude, max_longitude, min_longitude),
        ).fetchall()
        
        return {"message":"Warning places fetched successfully","list": list}
    except:
        raise HTTPException(status_code=500, detail="Failed to get warning places")

@app.get("/warning/id_get_place/{id}")
async def get_id_warning_places(
    id : int,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> dict:
    try:
        place = db.execute(
            "SELECT * from warning_place WHERE id = ?",
            (id),
        ).fetchone()
        return {"message":"Warning places fetched successfully","place": place}
    except:
        raise HTTPException(status_code=500, detail="Failed to get warning place")
    
@app.post("/warning/update_place_img/{id}")
