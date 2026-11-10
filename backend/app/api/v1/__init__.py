"""Version 1 API router aggregation."""

from fastapi import APIRouter

from app.api.v1.operations import router as operations_router
from app.api.v1.policies import router as policies_router

api_v1_router = APIRouter(prefix="/api/v1")
api_v1_router.include_router(policies_router)
api_v1_router.include_router(operations_router)
