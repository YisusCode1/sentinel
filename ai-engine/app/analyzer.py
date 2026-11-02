
from app.schemas import RiskAnalysisRequest, RiskAnalysisResponse


def analyze_risk(
    request: RiskAnalysisRequest,
) -> RiskAnalysisResponse:
    """
    Temporary mock analyzer.

    Replace this implementation with Gemini integration.
    This function must never authorize transactions.
    """

    return RiskAnalysisResponse(
        risk_level="MEDIUM",
        risk_score=50,
        alerts=["AI analysis is currently running in mock mode"],
        explanation=(
            "This is a simulated risk assessment. "
            "Gemini integration has not been implemented yet."
        ),
        recommendation="REVIEW",
    )
