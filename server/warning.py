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

class response_WarningPlace(BaseModel):
    list : List[db_WarningPlace]

class db_WarningPlace(BaseModel):
    id: int
    name: str
    latitude: float
    longitude: float
    description: str

@app.post("/warning/add_place")
async def add_warning_place(
    place: WarningPlace,
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
    

    try:
        db.execute(
            "SELECT * from warning_place WHERE latitude = ? AND longitude = ? AND latitude = ? AND longitude = ?",
            (origin_latitude, origin_longitude),
        
        )
    except: