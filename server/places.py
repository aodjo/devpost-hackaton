import os
from typing import Literal

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel


router = APIRouter(prefix="/places", tags=["places"])

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
PLACES_BASE_URL = "https://maps.googleapis.com/maps/api/place"


class TextSearchRequest(BaseModel):
    query: str
    location: str | None = None
    radius: int | None = None
    language: str = "ko"


class NearbySearchRequest(BaseModel):
    latitude: float
    longitude: float
    radius: int = 1000
    keyword: str | None = None
    type: str | None = None
    language: str = "ko"


class AutocompleteRequest(BaseModel):
    input: str
    location: str | None = None
    radius: int | None = None
    language: str = "ko"
    components: str | None = "country:kr"


async def _make_places_request(endpoint: str, params: dict) -> dict:
    if not GOOGLE_MAPS_API_KEY:
        raise HTTPException(status_code=500, detail="Google Maps API key not configured")

    params["key"] = GOOGLE_MAPS_API_KEY
    url = f"{PLACES_BASE_URL}/{endpoint}/json"

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(url, params=params)

    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="Google Places API request failed")

    data = response.json()
    status = data.get("status")

    if status == "REQUEST_DENIED":
        raise HTTPException(status_code=403, detail=data.get("error_message", "Request denied"))
    elif status == "OVER_QUERY_LIMIT":
        raise HTTPException(status_code=429, detail="API quota exceeded")
    elif status == "INVALID_REQUEST":
        raise HTTPException(status_code=400, detail="Invalid request")

    return data


@router.post("/search/text")
async def text_search(req: TextSearchRequest) -> dict:
    """
    텍스트로 장소 검색
    예: "서울역", "강남 카페", "홍대 음식점"
    """
    params = {
        "query": req.query,
        "language": req.language,
    }

    if req.location:
        params["location"] = req.location
    if req.radius:
        params["radius"] = req.radius

    data = await _make_places_request("textsearch", params)

    results = []
    for place in data.get("results", []):
        results.append({
            "place_id": place.get("place_id"),
            "name": place.get("name"),
            "address": place.get("formatted_address"),
            "latitude": place.get("geometry", {}).get("location", {}).get("lat"),
            "longitude": place.get("geometry", {}).get("location", {}).get("lng"),
            "types": place.get("types", []),
            "rating": place.get("rating"),
            "user_ratings_total": place.get("user_ratings_total"),
            "open_now": place.get("opening_hours", {}).get("open_now"),
        })

    return {
        "message": "Search completed",
        "count": len(results),
        "results": results,
        "next_page_token": data.get("next_page_token"),
    }


@router.post("/search/nearby")
async def nearby_search(req: NearbySearchRequest) -> dict:
    """
    주변 장소 검색
    위치 기반으로 반경 내 장소 검색
    """
    params = {
        "location": f"{req.latitude},{req.longitude}",
        "radius": req.radius,
        "language": req.language,
    }

    if req.keyword:
        params["keyword"] = req.keyword
    if req.type:
        params["type"] = req.type

    data = await _make_places_request("nearbysearch", params)

    results = []
    for place in data.get("results", []):
        results.append({
            "place_id": place.get("place_id"),
            "name": place.get("name"),
            "address": place.get("vicinity"),
            "latitude": place.get("geometry", {}).get("location", {}).get("lat"),
            "longitude": place.get("geometry", {}).get("location", {}).get("lng"),
            "types": place.get("types", []),
            "rating": place.get("rating"),
            "user_ratings_total": place.get("user_ratings_total"),
            "open_now": place.get("opening_hours", {}).get("open_now"),
        })

    return {
        "message": "Search completed",
        "count": len(results),
        "results": results,
        "next_page_token": data.get("next_page_token"),
    }


@router.get("/autocomplete")
async def autocomplete(
    input: str = Query(..., description="검색어"),
    location: str | None = Query(None, description="위도,경도 (예: 37.5665,126.9780)"),
    radius: int | None = Query(None, description="검색 반경 (미터)"),
    language: str = Query("ko", description="언어"),
) -> dict:
    """
    장소 자동완성
    검색어 입력 시 실시간 추천
    """
    params = {
        "input": input,
        "language": language,
        "components": "country:kr",
    }

    if location:
        params["location"] = location
    if radius:
        params["radius"] = radius

    data = await _make_places_request("autocomplete", params)

    predictions = []
    for pred in data.get("predictions", []):
        predictions.append({
            "place_id": pred.get("place_id"),
            "description": pred.get("description"),
            "main_text": pred.get("structured_formatting", {}).get("main_text"),
            "secondary_text": pred.get("structured_formatting", {}).get("secondary_text"),
            "types": pred.get("types", []),
        })

    return {
        "message": "Autocomplete completed",
        "count": len(predictions),
        "predictions": predictions,
    }


@router.get("/details/{place_id}")
async def place_details(
    place_id: str,
    language: str = Query("ko", description="언어"),
) -> dict:
    """
    장소 상세 정보 조회
    place_id로 상세 정보 가져오기
    """
    params = {
        "place_id": place_id,
        "language": language,
        "fields": "place_id,name,formatted_address,formatted_phone_number,geometry,types,rating,user_ratings_total,opening_hours,website,url",
    }

    data = await _make_places_request("details", params)

    result = data.get("result", {})

    return {
        "message": "Details retrieved",
        "place": {
            "place_id": result.get("place_id"),
            "name": result.get("name"),
            "address": result.get("formatted_address"),
            "phone": result.get("formatted_phone_number"),
            "latitude": result.get("geometry", {}).get("location", {}).get("lat"),
            "longitude": result.get("geometry", {}).get("location", {}).get("lng"),
            "types": result.get("types", []),
            "rating": result.get("rating"),
            "user_ratings_total": result.get("user_ratings_total"),
            "opening_hours": result.get("opening_hours", {}).get("weekday_text"),
            "open_now": result.get("opening_hours", {}).get("open_now"),
            "website": result.get("website"),
            "google_maps_url": result.get("url"),
        },
    }
