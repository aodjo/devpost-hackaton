import os
import sqlite3
import secrets
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import RedirectResponse

from db import get_db


router = APIRouter(tags=["auth"])

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
OAUTH_REDIRECT_URI = os.getenv("OAUTH_REDIRECT_URI", "http://localhost:8000/callback/google")

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

_oauth_states: dict[str, bool] = {}


@router.get("/auth/google")
async def auth_google():
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")

    state = secrets.token_urlsafe(32)
    _oauth_states[state] = True

    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": OAUTH_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
        "prompt": "consent",
    }

    auth_url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"
    return RedirectResponse(url=auth_url)


@router.get("/callback/google")
async def callback_google(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: sqlite3.Connection = Depends(get_db),
):
    if error:
        raise HTTPException(status_code=400, detail=f"OAuth error: {error}")

    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code or state")

    if state not in _oauth_states:
        raise HTTPException(status_code=400, detail="Invalid state")

    del _oauth_states[state]

    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": OAUTH_REDIRECT_URI,
            },
        )

        if token_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to get access token")

        tokens = token_response.json()
        access_token = tokens.get("access_token")

        userinfo_response = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )

        if userinfo_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to get user info")

        userinfo = userinfo_response.json()

    google_id = userinfo.get("id")
    email = userinfo.get("email")
    name = userinfo.get("name", email.split("@")[0] if email else "User")
    profile_image = userinfo.get("picture")

    existing_user = db.execute(
        "SELECT * FROM users WHERE google_id = ?",
        (google_id,),
    ).fetchone()

    if existing_user:
        user_id = existing_user["id"]
        db.execute(
            "UPDATE users SET email = ?, username = ?, profile_image = ? WHERE id = ?",
            (email, name, profile_image, user_id),
        )
    else:
        cursor = db.execute(
            "INSERT INTO users (username, email, google_id, profile_image) VALUES (?, ?, ?, ?)",
            (name, email, google_id, profile_image),
        )
        user_id = cursor.lastrowid

    user = db.execute(
        "SELECT * FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()

    return {
        "message": "Login successful",
        "user": dict(user),
        "access_token": access_token,
    }


@router.get("/auth/me")
async def get_current_user(
    request: Request,
    db: sqlite3.Connection = Depends(get_db),
):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    access_token = auth_header.split(" ")[1]

    async with httpx.AsyncClient() as client:
        response = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )

        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        userinfo = response.json()

    google_id = userinfo.get("id")

    user = db.execute(
        "SELECT * FROM users WHERE google_id = ?",
        (google_id,),
    ).fetchone()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    badges = db.execute(
        "SELECT badge_name, earned_at FROM user_badges WHERE user_id = ?",
        (user["id"],),
    ).fetchall()

    return {
        "user": dict(user),
        "badges": [dict(b) for b in badges],
    }
