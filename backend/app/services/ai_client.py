
import os

import httpx

from app.schemas.operation import AIAnalysisResponse
from app.schemas.assistant import AssistantRequest, AssistantResponse


AI_ENGINE_URL = os.getenv(
    "AI_ENGINE_URL",
    "http://localhost:8002",
)

INTERNAL_SERVICE_KEY = os.getenv("INTERNAL_SERVICE_KEY")

AI_ENGINE_TIMEOUT = float(os.getenv("AI_ENGINE_TIMEOUT_SECONDS", "40"))


def unavailable_analysis(error: Exception) -> AIAnalysisResponse:
    """Fallback advisory; never changes the Policy Engine decision."""

    return AIAnalysisResponse(
        risk_level="unknown",
        risk_score=50,
        flags=[
            "ai_analysis_unavailable",
            "fallback_triggered",
        ],
        explanation=(
            "AI risk analysis is unavailable due to provider error, "
            "timeout, or invalid response. "
            "The deterministic Policy Engine remains authoritative."
        ),
        evidence=[
            f"error_type:{type(error).__name__}",
        ],
        analysis_available=False,
        model_used=None,
        latency_ms=None,
    )


def analyze_with_ai(operation, policy, agent_id: str, history_context: dict | None = None) -> AIAnalysisResponse:
    """
    Calls the internal AI Engine.

    The authenticated agent identity comes from the backend.
    AI analysis is advisory and cannot authorize operations.
    """

    if not INTERNAL_SERVICE_KEY:
        return unavailable_analysis(
            RuntimeError("Internal AI service key is not configured")
        )

    payload = {
        "agent_id": agent_id,
        "policy_id": str(operation.policy_id),
        "network": operation.network,
        "operation": operation.operation,
        "token": operation.token,
        "amount": str(operation.amount),
        "recipient": operation.recipient,
        "policy_max_amount": str(policy.max_amount),
        "allowed_tokens": policy.allowed_tokens,
        "allowed_recipients": policy.allowed_recipients,
        **(history_context or {}),
    }

    try:
        response = httpx.post(
            f"{AI_ENGINE_URL.rstrip('/')}/analyze",
            json=payload,
            headers={
                "X-Internal-Service-Key": INTERNAL_SERVICE_KEY,
            },
            timeout=AI_ENGINE_TIMEOUT,
        )

        response.raise_for_status()

        return AIAnalysisResponse.model_validate(response.json())

    except Exception as error:
        # AI failures must never prevent deterministic evaluation.
        return unavailable_analysis(error)


def chat_with_ai(request: AssistantRequest, context: dict) -> AssistantResponse:
    try:
        if not INTERNAL_SERVICE_KEY:
            raise RuntimeError("Internal service key missing")
        response = httpx.post(
            f"{AI_ENGINE_URL.rstrip('/')}/assistant/chat",
            json={"message": request.message,
                  "history": [item.model_dump() for item in request.history],
                  "context": context},
            headers={"X-Internal-Service-Key": INTERNAL_SERVICE_KEY},
            timeout=AI_ENGINE_TIMEOUT,
        )
        response.raise_for_status()
        return AssistantResponse.model_validate(response.json())
    except (httpx.HTTPError, ValueError, RuntimeError):
        return AssistantResponse(
            reply="El motor de IA no está disponible. Las decisiones guardadas del motor de políticas siguen vigentes. Inténtalo de nuevo.",
            mode="unavailable", warnings=["ai_engine_unavailable"],
        )
