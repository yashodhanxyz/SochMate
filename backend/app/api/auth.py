"""
Auth API router.

Endpoints:
  POST /api/auth/register  — create account, return JWT
  POST /api/auth/login     — verify credentials, return JWT
  POST /api/auth/google    — verify Google id_token, return JWT
  GET  /api/auth/me        — return current user profile
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.config import settings
from app.database import get_db
from app.models.user import User
from app.services.auth import create_access_token, hash_password, verify_password

router = APIRouter()


# ---------------------------------------------------------------------------
# Request / response schemas (auth-specific, not worth a separate schemas file)
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    username: str | None = None

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    username: str | None


class UserProfileResponse(BaseModel):
    user_id: str
    email: str
    username: str | None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Create a new account. Returns a JWT immediately so the user is logged in."""
    existing = await db.scalar(select(User).where(User.email == body.email))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        username=body.username,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(str(user.id))
    return TokenResponse(
        access_token=token,
        user_id=str(user.id),
        email=user.email,
        username=user.username,
    )


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Verify email + password, return a JWT."""
    user = await db.scalar(select(User).where(User.email == body.email))

    if user is None or not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    token = create_access_token(str(user.id))
    return TokenResponse(
        access_token=token,
        user_id=str(user.id),
        email=user.email,
        username=user.username,
    )


class GoogleRequest(BaseModel):
    id_token: str


@router.post("/google", response_model=TokenResponse)
async def google_auth(body: GoogleRequest, db: AsyncSession = Depends(get_db)):
    """
    Verify a Google id_token issued by the frontend (Google Identity Services).
    Find or create the user by email, return our own JWT.
    """
    if not settings.google_client_id:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Google login is not configured on this server.",
        )

    try:
        info = google_id_token.verify_oauth2_token(
            body.id_token,
            google_requests.Request(),
            settings.google_client_id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google token: {exc}",
        )

    email: str = info["email"]
    name: str | None = info.get("name")

    # Find existing user or create one (no password for Google users)
    user = await db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(email=email, username=name)
        db.add(user)
        await db.commit()
        await db.refresh(user)

    token = create_access_token(str(user.id))
    return TokenResponse(
        access_token=token,
        user_id=str(user.id),
        email=user.email,
        username=user.username,
    )


@router.get("/me", response_model=UserProfileResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the authenticated user's profile."""
    return UserProfileResponse(
        user_id=str(current_user.id),
        email=current_user.email,
        username=current_user.username,
    )
