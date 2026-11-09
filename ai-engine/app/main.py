from fastapi import Depends, FastAPI, Header, HTTPException
import hmac
from analyzer.config import get_settings
from app.analyzer import analyze_risk
from app.schemas import RiskAnalysisRequest, RiskAnalysisResponse


app = FastAPI(
    title="Sentinel AI Engine",
    description="AI-powered blockchain operation risk analysis",
    version="0.2.0",
)

def verify_internal_service_key(
    x_internal_service_key: str | None = Header(
        default=None,
        alias="X-Internal-Service-Key",
    ),
):
    settings = get_settings()

    if settings.INTERNAL_SERVICE_KEY is None:
        raise HTTPException(
            status_code=503,
            detail="AI Engine internal authentication is not configured",
        )

    if not x_internal_service_key:
        raise HTTPException(
            status_code=401,
            detail="Invalid internal service credentials",
        )

    expected_key = settings.INTERNAL_SERVICE_KEY.get_secret_value()

    if not hmac.compare_digest(
        x_internal_service_key,
        expected_key,
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid internal service credentials",
        )


@app.get("/health")
def health():
    settings = get_settings()

    return {
        "service": "sentinel-ai-engine",
        "status": "healthy",
        "mode": "gemini",
        "model": settings.GEMINI_MODEL,
        "configured": settings.GEMINI_API_KEY is not None,
    }


@app.post(
    "/analyze",
    response_model=RiskAnalysisResponse,
    dependencies=[
        Depends(verify_internal_service_key)
    ],
)
async def analyze(request: RiskAnalysisRequest):
    return await analyze_risk(request)
