import os
import math
from typing import Literal

import httpx
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import sqlite3

from db import get_db


router = APIRouter(prefix="/directions", tags=["directions"])

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
DIRECTIONS_API_URL = "https://maps.googleapis.com/maps/api/directions/json"

# 경로에서 장애물까지의 거리 임계값 (미터)
OBSTACLE_DETECTION_RADIUS = 15


class DirectionsRequest(BaseModel):
    origin_latitude: float
    origin_longitude: float
    destination_latitude: float
    destination_longitude: float
    avoid_obstacles: bool = True
    language: str = "ko"


class PlaceDirectionsRequest(BaseModel):
    origin_latitude: float
    origin_longitude: float
    destination_place_id: str
    avoid_obstacles: bool = True
    language: str = "ko"


def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """두 좌표 사이의 거리를 미터로 계산"""
    R = 6371000  # 지구 반지름 (미터)
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


def _point_to_segment_distance(
    px: float, py: float,
    ax: float, ay: float,
    bx: float, by: float
) -> float:
    """점 P에서 선분 AB까지의 최단 거리 (미터)"""
    # 벡터 AB, AP
    ab_x, ab_y = bx - ax, by - ay
    ap_x, ap_y = px - ax, py - ay

    ab_len_sq = ab_x * ab_x + ab_y * ab_y

    if ab_len_sq == 0:
        return _haversine_distance(px, py, ax, ay)

    # 투영 비율 t (0~1 사이면 선분 위)
    t = max(0, min(1, (ap_x * ab_x + ap_y * ab_y) / ab_len_sq))

    # 선분 위 가장 가까운 점
    closest_x = ax + t * ab_x
    closest_y = ay + t * ab_y

    return _haversine_distance(px, py, closest_x, closest_y)


def _decode_polyline(polyline_str: str) -> list[tuple[float, float]]:
    """Google Polyline 디코딩"""
    index, lat, lng = 0, 0, 0
    coordinates = []

    while index < len(polyline_str):
        # 위도 디코딩
        shift, result = 0, 0
        while True:
            b = ord(polyline_str[index]) - 63
            index += 1
            result |= (b & 0x1f) << shift
            shift += 5
            if b < 0x20:
                break
        lat += ~(result >> 1) if result & 1 else result >> 1

        # 경도 디코딩
        shift, result = 0, 0
        while True:
            b = ord(polyline_str[index]) - 63
            index += 1
            result |= (b & 0x1f) << shift
            shift += 5
            if b < 0x20:
                break
        lng += ~(result >> 1) if result & 1 else result >> 1

        coordinates.append((lat / 1e5, lng / 1e5))

    return coordinates


def _get_obstacles_near_route(
    db: sqlite3.Connection,
    route_points: list[tuple[float, float]],
    radius: float = OBSTACLE_DETECTION_RADIUS
) -> list[dict]:
    """경로 근처의 장애물 조회"""
    if not route_points:
        return []

    # 경로의 bounding box 계산 (여유분 추가)
    lats = [p[0] for p in route_points]
    lngs = [p[1] for p in route_points]
    margin = 0.002  # 약 200m 여유

    min_lat, max_lat = min(lats) - margin, max(lats) + margin
    min_lng, max_lng = min(lngs) - margin, max(lngs) + margin

    # DB에서 해당 영역의 장애물 조회
    rows = db.execute(
        """SELECT id, latitude, longitude, type, name, description
           FROM warning_places
           WHERE latitude >= ? AND latitude <= ?
           AND longitude >= ? AND longitude <= ?""",
        (min_lat, max_lat, min_lng, max_lng)
    ).fetchall()

    obstacles_on_route = []

    for row in rows:
        obs_lat, obs_lng = row["latitude"], row["longitude"]

        # 각 경로 세그먼트와의 거리 확인
        for i in range(len(route_points) - 1):
            p1 = route_points[i]
            p2 = route_points[i + 1]

            distance = _point_to_segment_distance(
                obs_lat, obs_lng,
                p1[0], p1[1],
                p2[0], p2[1]
            )

            if distance <= radius:
                obstacles_on_route.append({
                    "id": row["id"],
                    "latitude": obs_lat,
                    "longitude": obs_lng,
                    "type": row["type"],
                    "name": row["name"],
                    "description": row["description"],
                    "distance_from_route": round(distance, 1)
                })
                break  # 이 장애물은 이미 추가됨

    return obstacles_on_route


async def _fetch_directions(
    origin: str,
    destination: str,
    language: str = "ko",
    waypoints: list[str] | None = None,
    alternatives: bool = False
) -> dict:
    """Google Directions API 호출"""
    if not GOOGLE_MAPS_API_KEY:
        raise HTTPException(status_code=500, detail="Google Maps API key not configured")

    params = {
        "origin": origin,
        "destination": destination,
        "mode": "walking",
        "language": language,
        "key": GOOGLE_MAPS_API_KEY,
    }

    if waypoints:
        params["waypoints"] = "|".join(waypoints)

    if alternatives:
        params["alternatives"] = "true"

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(DIRECTIONS_API_URL, params=params)

    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="Google Directions API request failed")

    data = response.json()

    if data.get("status") == "ZERO_RESULTS":
        raise HTTPException(status_code=404, detail="No route found")
    elif data.get("status") != "OK":
        raise HTTPException(status_code=400, detail=f"Directions API error: {data.get('status')}")

    return data


def _parse_route(route: dict) -> dict:
    """Google Directions 응답에서 경로 정보 추출"""
    leg = route["legs"][0]

    steps = []
    for step in leg["steps"]:
        steps.append({
            "instruction": step.get("html_instructions", ""),
            "distance": step["distance"]["text"],
            "distance_value": step["distance"]["value"],
            "duration": step["duration"]["text"],
            "duration_value": step["duration"]["value"],
            "start_location": step["start_location"],
            "end_location": step["end_location"],
            "polyline": step["polyline"]["points"],
            "maneuver": step.get("maneuver", ""),
        })

    return {
        "summary": route.get("summary", ""),
        "distance": leg["distance"]["text"],
        "distance_value": leg["distance"]["value"],
        "duration": leg["duration"]["text"],
        "duration_value": leg["duration"]["value"],
        "start_address": leg.get("start_address", ""),
        "end_address": leg.get("end_address", ""),
        "start_location": leg["start_location"],
        "end_location": leg["end_location"],
        "steps": steps,
        "overview_polyline": route["overview_polyline"]["points"],
    }


@router.post("/walking")
async def get_walking_directions(
    req: DirectionsRequest,
    db: sqlite3.Connection = Depends(get_db),
) -> dict:
    """
    도보 길찾기 API

    - origin/destination 좌표로 경로 검색
    - avoid_obstacles=true면 경로상 장애물 감지 및 대체 경로 제안
    """
    origin = f"{req.origin_latitude},{req.origin_longitude}"
    destination = f"{req.destination_latitude},{req.destination_longitude}"

    # 대체 경로도 함께 요청
    data = await _fetch_directions(
        origin, destination,
        language=req.language,
        alternatives=True
    )

    routes = []

    for i, route in enumerate(data.get("routes", [])):
        parsed = _parse_route(route)

        # 경로 상의 장애물 감지
        if req.avoid_obstacles:
            polyline_points = _decode_polyline(parsed["overview_polyline"])
            obstacles = _get_obstacles_near_route(db, polyline_points)
            parsed["obstacles"] = obstacles
            parsed["obstacle_count"] = len(obstacles)
            parsed["is_accessible"] = len(obstacles) == 0
        else:
            parsed["obstacles"] = []
            parsed["obstacle_count"] = 0
            parsed["is_accessible"] = True

        parsed["route_index"] = i
        routes.append(parsed)

    # 장애물이 적은 순으로 정렬
    if req.avoid_obstacles:
        routes.sort(key=lambda r: (r["obstacle_count"], r["duration_value"]))

    recommended = routes[0] if routes else None

    return {
        "message": "Directions found",
        "recommended_route": recommended,
        "alternative_routes": routes[1:] if len(routes) > 1 else [],
        "total_routes": len(routes),
    }


@router.post("/walking/place")
async def get_walking_directions_to_place(
    req: PlaceDirectionsRequest,
    db: sqlite3.Connection = Depends(get_db),
) -> dict:
    """
    도보 길찾기 API (목적지: place_id)

    - Google Place ID로 목적지 지정
    """
    origin = f"{req.origin_latitude},{req.origin_longitude}"
    destination = f"place_id:{req.destination_place_id}"

    data = await _fetch_directions(
        origin, destination,
        language=req.language,
        alternatives=True
    )

    routes = []

    for i, route in enumerate(data.get("routes", [])):
        parsed = _parse_route(route)

        if req.avoid_obstacles:
            polyline_points = _decode_polyline(parsed["overview_polyline"])
            obstacles = _get_obstacles_near_route(db, polyline_points)
            parsed["obstacles"] = obstacles
            parsed["obstacle_count"] = len(obstacles)
            parsed["is_accessible"] = len(obstacles) == 0
        else:
            parsed["obstacles"] = []
            parsed["obstacle_count"] = 0
            parsed["is_accessible"] = True

        parsed["route_index"] = i
        routes.append(parsed)

    if req.avoid_obstacles:
        routes.sort(key=lambda r: (r["obstacle_count"], r["duration_value"]))

    recommended = routes[0] if routes else None

    return {
        "message": "Directions found",
        "recommended_route": recommended,
        "alternative_routes": routes[1:] if len(routes) > 1 else [],
        "total_routes": len(routes),
    }
