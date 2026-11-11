from fastapi import Depends, FastAPI, Header, HTTPException
import hmac
from analyzer.config import get_settings
from analyzer.service import analyze_for_api, assistant_chat
from analyzer.schemas import OperationAnalysisRequest, RiskAnalysisResponse, AssistantRequest, AssistantResponse


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

    if settings.INTERNAL_SERVICE_KEY is None or not settings.INTERNAL_SERVICE_KEY.get_secret_value().strip():
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
        x_internal_service_key.encode("utf-8"),
        expected_key.encode("utf-8"),
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
        "status": "healthy" if settings.INTERNAL_SERVICE_KEY and settings.INTERNAL_SERVICE_KEY.get_secret_value().strip() else "misconfigured",
        "mode": "gemini" if settings.provider_key else "demo" if settings.AI_DEMO_FALLBACK else "unavailable",
        "model": settings.GEMINI_MODEL,
        "configured": bool(settings.provider_key),
        "provider_verified": False,
        "fallback_enabled": settings.AI_DEMO_FALLBACK,
    }


@app.post(
    "/analyze",
    response_model=RiskAnalysisResponse,
    dependencies=[
        Depends(verify_internal_service_key)
    ],
)
async def analyze(request: OperationAnalysisRequest):
    return await analyze_for_api(request)


@app.post("/assistant/chat", response_model=AssistantResponse,
          dependencies=[Depends(verify_internal_service_key)])
async def chat(request: AssistantRequest):
    import json
    if len(json.dumps(request.context.model_dump(mode="json"))) > 100_000:
        raise HTTPException(status_code=413, detail="Assistant context is too large")
    return await assistant_chat(request)
