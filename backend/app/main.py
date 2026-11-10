"""Sentinel Backend Application.

Provides security orchestration, deterministic policy enforcement,
and advisory AI risk evaluation for blockchain agent operations.
"""

import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from app.api.v1 import api_v1_router
from app.core.database import Base, engine

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initializes database schema and manages application lifecycle."""
    # Ensure models are imported so Base.metadata knows about all tables
    import app.models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    logger.info("Database schema initialized.")
    yield


app = FastAPI(
    title="Sentinel API",
    description="AI Agent Security Infrastructure",
    version="0.3.0",
    lifespan=lifespan,
)

# CORS configuration aligned with Frontend contract
allowed_origins_env = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174",
)
allowed_origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["X-API-Key", "Content-Type"],
)

# Include versioned API routers
app.include_router(api_v1_router)


# ============================================================
# PUBLIC ENDPOINTS
# ============================================================

@app.get("/", tags=["Public"])
def root() -> dict[str, str]:
    """Root status indicator."""
    return {
        "project": "Sentinel",
        "message": "AI Agent Security Infrastructure",
        "status": "running",
    }


@app.get("/api/v1/health", tags=["Public"])
def health() -> dict[str, str]:
    """Health check for service monitoring."""
    return {
        "status": "healthy",
        "service": "sentinel-backend",
    }
