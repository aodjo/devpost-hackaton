import sqlite3
import os
from db import get_db
from fastapi import HTTPException, UploadFile, File
from fastapi.responses import FileResponse 
from PIL import Image, UnidentifiedImageError
from pathlib import Path
import shutil
import io

class request_Add_WarningPlace(BaseModel):
    name: str
    latitude: float
    longitude: float
    description: str

class request_list_WarningPlace():
    origin_latitude: float
    origin_longitude: float
    endpoint_latitude: float
    endpoint_longitude: float

@app.post("/warning/add_place")
async def add_warning_place(
    place: request_Add_WarningPlace,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> dict:
    try:
        db.execute(
            "INSERT INTO warning_places (name, latitude, longitude, description) VALUES (?, ?, ?, ?)",
            (place.name, place.latitude, place.longitude, place.description),
        )
        return {"message": "Warning place added successfully", "id" : db.lastrowid}
    except type(db).OperationalError:
        raise HTTPException(status_code=500, detail="Database operational error")
    except:
        raise HTTPException(status_code=500, detail="Failed to add warning place")
    
@app.post("/warning/get_place/")
async def get_warning_places(
    place: request_list_WarningPlace,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> dict:
    max_latitiude = max(place.origin_latitude, place.endpoint_latitude) + 0.001
    min_latitude = min(place.origin_latitude, place.endpoint_latitude) - 0.001
    max_longitude = max(place.origin_longitude, place.endpoint_longitude) + 0.001
    min_longitude = min(place.origin_longitude, place.endpoint_longitude) - 0.001

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

warning_place_img_path = os.getenv("WARNING_PLACE_IMG_PATH") or "./warning_place_img"  

@app.post("/warning/update_place_img/{id}")
async def update_warning_place_img(
    id : int,
    img : Uploadfile = File(...),
) -> dict:
    try:
        if image.content_type != "image/png":
            raise HTTPException(status_code=415, detail="PNG만 업로드 가능합니다 (content-type).")
        
        if not (image.filename or "").lower().endswith(".png"):
            raise HTTPException(status_code=415, detail="PNG만 업로드 가능합니다 (확장자).")

        data = await img.read()
        im = Image.open(io.BytesIO(data))
        im.verify()

        orig_suffix = Path(".png").suffix

        filename = f"{id}{orig_suffix}"
        save_path = warning_place_img_path / filename

        with save_path.open("wb") as f:
            shutil.copyfileobj(img.file, f)

        return {"message": "Warning place image updated successfully"}               
    except UnidentfiedImageError:
        return HTTPException(status_code=400, detail="Invalid image format")
    
    except:
        return HTTPException(status_code=500, detail="Failed to update warning place image")       
    
@app.get("/warning/get_place_img/{id}")
async def get_warning_place_img(
    id : int,
):
    try:
       path = warning_place_img_path / f"{id}.png"
       if not path.is_file():
           raise HTTPException(status_code=404, detail="Warning place image not found")
       return FileResponse(path, media_type="image/png")
    except:
        raise HTTPException(status_code=500, detail="Failed to get warning place image")