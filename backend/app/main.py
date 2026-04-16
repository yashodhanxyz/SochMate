from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: nothing needed yet (DB tables created via Alembic)
    yield
    # Shutdown


app = FastAPI(
    title="SochMate API",
    version="0.1.0",
    description="Chess game analysis API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Routers registered here as they are built
from app.api import games, users  # noqa: E402

app.include_router(games.router, prefix="/api/games", tags=["games"])
app.include_router(users.router, prefix="/api/users", tags=["users"])


@app.get("/health")
async def health():
    return {"status": "ok"}
