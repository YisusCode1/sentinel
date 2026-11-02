
from fastapi import FastAPI

from app.analyzer import analyze_risk
from app.schemas import RiskAnalysisRequest, RiskAnalysisResponse


app = FastAPI(
    title="Sentinel AI Engine",
    description="AI-powered blockchain operation risk analysis",
    version="0.1.0",
)


@app.get("/health")
def health():
    return {
        "service": "sentinel-ai-engine",
        "status": "healthy",
        "mode": "mock",
    }


@app.post(
    "/analyze",
    response_model=RiskAnalysisResponse,
)
def analyze(request: RiskAnalysisRequest):
    return analyze_risk(request)
