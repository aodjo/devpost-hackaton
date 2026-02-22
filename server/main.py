import asyncio
import os
import re
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import PlainTextResponse
from dotenv import load_dotenv

from db import init_db
from warning import router as warning_router
from badge import router as badge_router
from auth import router as auth_router

load_dotenv(Path(__file__).with_name(".env"))

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
DEFAULT_MAP_TYPE = os.getenv("GOOGLE_MAP_TYPE", "roadmap")
DEFAULT_TILE_LANGUAGE = os.getenv("GOOGLE_TILE_LANGUAGE", "en-US")
DEFAULT_TILE_REGION = os.getenv("GOOGLE_TILE_REGION", "US")
TILE_TIMEOUT_SECONDS = float(os.getenv("TILE_TIMEOUT_SECONDS", "12"))
SESSION_FALLBACK_TTL_SECONDS = int(os.getenv("SESSION_FALLBACK_TTL_SECONDS", "600"))
MAX_ZOOM = int(os.getenv("MAX_ZOOM", "22"))
SESSION_REFRESH_GRACE_SECONDS = int(os.getenv("SESSION_REFRESH_GRACE_SECONDS", "60"))
MAX_SESSION_CACHE_SIZE = int(os.getenv("MAX_SESSION_CACHE_SIZE", "128"))

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Google Tiles Proxy", lifespan=lifespan)

app.include_router(warning_router)
app.include_router(badge_router)
app.include_router(auth_router)

_session_entries: dict[str, tuple[str, float]] = {}
_session_locks: dict[str, asyncio.Lock] = {}
_session_locks_guard = asyncio.Lock()

MAP_TYPE_PATTERN = re.compile(r"^(roadmap|satellite|terrain)$", re.IGNORECASE)
LANGUAGE_PATTERN = re.compile(r"^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,2}$")
REGION_PATTERN = re.compile(r"^[A-Za-z]{2}$")


def _parse_rfc3339(value: str | None) -> float | None:
    if not value:
        return None
    candidate = value.strip()
    if candidate.endswith("Z"):
        candidate = candidate[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(candidate)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.timestamp()
    except ValueError:
        return None


def _validate_xyz(z: int, x: int, y: int) -> None:
    if z < 0 or z > MAX_ZOOM:
        raise HTTPException(status_code=400, detail="Invalid z")
    if x < 0 or y < 0:
        raise HTTPException(status_code=400, detail="Invalid x/y")
    max_index = (1 << z) - 1
    if x > max_index or y > max_index:
        raise HTTPException(status_code=400, detail="Out of range x/y for z")


def _normalize_map_type(map_type: str | None) -> str:
    candidate = (map_type or DEFAULT_MAP_TYPE).strip().lower()
    if not MAP_TYPE_PATTERN.fullmatch(candidate):
        return DEFAULT_MAP_TYPE
    return candidate


def _normalize_language(language: str | None) -> str:
    candidate = (language or DEFAULT_TILE_LANGUAGE).strip().replace("_", "-")
    if not LANGUAGE_PATTERN.fullmatch(candidate):
        return DEFAULT_TILE_LANGUAGE
    return candidate


def _normalize_region(region: str | None) -> str:
    candidate = (region or DEFAULT_TILE_REGION).strip().upper()
    if not REGION_PATTERN.fullmatch(candidate):
        return DEFAULT_TILE_REGION
    return candidate


def _build_session_key(map_type: str, language: str, region: str) -> str:
    return f"{map_type}|{language}|{region}"


async def _get_session_lock(session_key: str) -> asyncio.Lock:
    async with _session_locks_guard:
        lock = _session_locks.get(session_key)
        if lock is None:
            lock = asyncio.Lock()
            _session_locks[session_key] = lock
        return lock


def _trim_session_cache() -> None:
    if len(_session_entries) <= MAX_SESSION_CACHE_SIZE:
        return

    # Drop the oldest-expiring sessions first.
    for key, _ in sorted(_session_entries.items(), key=lambda item: item[1][1])[
        : len(_session_entries) - MAX_SESSION_CACHE_SIZE
    ]:
        _session_entries.pop(key, None)


async def _create_google_session(map_type: str, language: str, region: str) -> tuple[str, float]:
    if not GOOGLE_MAPS_API_KEY:
        raise HTTPException(
            status_code=500, detail="GOOGLE_MAPS_API_KEY is not configured on server"
        )

    payload = {
        "mapType": map_type,
        "language": language,
        "region": region,
    }
    url = f"https://tile.googleapis.com/v1/createSession?key={GOOGLE_MAPS_API_KEY}"

    async with httpx.AsyncClient(timeout=TILE_TIMEOUT_SECONDS) as client:
        response = await client.post(url, json=payload)

    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to create Google tile session ({response.status_code})",
        )

    body = response.json()
    session = body.get("session")
    if not session:
        raise HTTPException(status_code=502, detail="Missing session in Google response")

    expires_at = _parse_rfc3339(body.get("expiry")) or (
        time.time() + SESSION_FALLBACK_TTL_SECONDS
    )
    return session, expires_at


async def _get_google_session(map_type: str, language: str, region: str) -> str:
    session_key = _build_session_key(map_type, language, region)

    now = time.time()
    current = _session_entries.get(session_key)
    if current and now < (current[1] - SESSION_REFRESH_GRACE_SECONDS):
        return current[0]

    lock = await _get_session_lock(session_key)
    async with lock:
        now = time.time()
        current = _session_entries.get(session_key)
        if current and now < (current[1] - SESSION_REFRESH_GRACE_SECONDS):
            return current[0]

        token, expires_at = await _create_google_session(map_type, language, region)
        _session_entries[session_key] = (token, expires_at)
        _trim_session_cache()
        return token


async def _fetch_tile(
    z: int,
    x: int,
    y: int,
    map_type: str,
    language: str,
    region: str,
    force_new_session: bool = False,
) -> httpx.Response:
    session_key = _build_session_key(map_type, language, region)

    if force_new_session:
        lock = await _get_session_lock(session_key)
        async with lock:
            token, expires_at = await _create_google_session(map_type, language, region)
            _session_entries[session_key] = (token, expires_at)
            _trim_session_cache()
            session = token
    else:
        session = await _get_google_session(map_type, language, region)

    url = (
        f"https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}"
        f"?session={session}&key={GOOGLE_MAPS_API_KEY}"
    )

    async with httpx.AsyncClient(timeout=TILE_TIMEOUT_SECONDS) as client:
        return await client.get(url)


@app.get("/health", response_class=PlainTextResponse)
async def health() -> str:
    return "ok"


@app.get("/maps/tiles/{z}/{x}/{y}.png")
async def tile_proxy(
    z: int,
    x: int,
    y: int,
    lang: str | None = None,
    region: str | None = None,
    mapType: str | None = None,
) -> Response:
    _validate_xyz(z, x, y)

    tile_language = _normalize_language(lang)
    tile_region = _normalize_region(region)
    map_type = _normalize_map_type(mapType)

    response = await _fetch_tile(z, x, y, map_type, tile_language, tile_region)
    if response.status_code in (401, 403):
        response = await _fetch_tile(
            z,
            x,
            y,
            map_type,
            tile_language,
            tile_region,
            force_new_session=True,
        )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=response.status_code,
            detail=f"Google tile request failed ({response.status_code})",
        )

    content_type = response.headers.get("content-type", "image/png")
    cache_control = response.headers.get("cache-control", "public, max-age=3600")

    return Response(
        content=response.content,
        media_type=content_type,
        headers={
            "Cache-Control": cache_control,
            "X-Tile-Proxy": "google-map-tiles",
            "X-Tile-Language": tile_language,
            "X-Tile-Region": tile_region,
        },
    )
if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host=host, port=port)


