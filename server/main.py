import asyncio
import hashlib
import os
import re
import time
from collections import OrderedDict
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).with_name(".env"))

import httpx
from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import PlainTextResponse

from db import init_db
from warning import router as warning_router
from badge import router as badge_router
from auth import router as auth_router
from places import router as places_router

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
DEFAULT_MAP_TYPE = os.getenv("GOOGLE_MAP_TYPE", "roadmap")
DEFAULT_TILE_LANGUAGE = os.getenv("GOOGLE_TILE_LANGUAGE", "en-US")
DEFAULT_TILE_REGION = os.getenv("GOOGLE_TILE_REGION", "US")
TILE_TIMEOUT_SECONDS = float(os.getenv("TILE_TIMEOUT_SECONDS", "12"))
SESSION_FALLBACK_TTL_SECONDS = int(os.getenv("SESSION_FALLBACK_TTL_SECONDS", "600"))
MAX_ZOOM = int(os.getenv("MAX_ZOOM", "22"))
SESSION_REFRESH_GRACE_SECONDS = int(os.getenv("SESSION_REFRESH_GRACE_SECONDS", "60"))
MAX_SESSION_CACHE_SIZE = int(os.getenv("MAX_SESSION_CACHE_SIZE", "128"))
TILE_CACHE_SIZE = int(os.getenv("TILE_CACHE_SIZE", "1000"))
TILE_CACHE_TTL_SECONDS = int(os.getenv("TILE_CACHE_TTL_SECONDS", "3600"))

_http_client: httpx.AsyncClient | None = None


def _get_http_client() -> httpx.AsyncClient:
    if _http_client is None:
        raise RuntimeError("HTTP client not initialized")
    return _http_client


class TileCache:
    def __init__(self, max_size: int, ttl_seconds: int):
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self._cache: OrderedDict[str, tuple[bytes, str, float]] = OrderedDict()
        self._lock = asyncio.Lock()

    def _make_key(self, z: int, x: int, y: int, map_type: str, lang: str, region: str) -> str:
        return f"{z}/{x}/{y}/{map_type}/{lang}/{region}"

    async def get(self, z: int, x: int, y: int, map_type: str, lang: str, region: str) -> tuple[bytes, str] | None:
        key = self._make_key(z, x, y, map_type, lang, region)
        async with self._lock:
            if key not in self._cache:
                return None
            content, content_type, timestamp = self._cache[key]
            if time.time() - timestamp > self.ttl_seconds:
                del self._cache[key]
                return None
            self._cache.move_to_end(key)
            return content, content_type

    async def set(self, z: int, x: int, y: int, map_type: str, lang: str, region: str, content: bytes, content_type: str):
        key = self._make_key(z, x, y, map_type, lang, region)
        async with self._lock:
            if key in self._cache:
                del self._cache[key]
            self._cache[key] = (content, content_type, time.time())
            while len(self._cache) > self.max_size:
                self._cache.popitem(last=False)


_tile_cache = TileCache(TILE_CACHE_SIZE, TILE_CACHE_TTL_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _http_client
    init_db()
    _http_client = httpx.AsyncClient(
        timeout=TILE_TIMEOUT_SECONDS,
        http2=True,
        limits=httpx.Limits(max_keepalive_connections=20, max_connections=100),
    )
    yield
    await _http_client.aclose()
    _http_client = None


app = FastAPI(title="Google Tiles Proxy", lifespan=lifespan)

app.include_router(warning_router)
app.include_router(badge_router)
app.include_router(auth_router)
app.include_router(places_router)

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

    client = _get_http_client()
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

    client = _get_http_client()
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

    cached = await _tile_cache.get(z, x, y, map_type, tile_language, tile_region)
    if cached:
        content, content_type = cached
        return Response(
            content=content,
            media_type=content_type,
            headers={
                "Cache-Control": f"public, max-age={TILE_CACHE_TTL_SECONDS}",
                "X-Tile-Proxy": "google-map-tiles",
                "X-Tile-Language": tile_language,
                "X-Tile-Region": tile_region,
                "X-Cache": "HIT",
            },
        )

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
    content = response.content

    await _tile_cache.set(z, x, y, map_type, tile_language, tile_region, content, content_type)

    return Response(
        content=content,
        media_type=content_type,
        headers={
            "Cache-Control": f"public, max-age={TILE_CACHE_TTL_SECONDS}",
            "X-Tile-Proxy": "google-map-tiles",
            "X-Tile-Language": tile_language,
            "X-Tile-Region": tile_region,
            "X-Cache": "MISS",
        },
    )
if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host=host, port=port)


