"""Asynchronous client for the Sentinel AI Engine microservice.

Communicates with the AI Engine to obtain advisory risk scores, contextual flags,
and anomaly insights. If the AI Engine is offline, times out, or errors,
it gracefully falls back to an 'unknown' advisory state without interrupting
the authoritative Policy Engine evaluation.
"""

import logging
import os
from typing import Any

from dotenv import load_dotenv
import httpx

load_dotenv()

from app.schemas.operation import AIAnalysisResponse, OperationRequest
from app.schemas.policy import PolicyResponse

logger = logging.getLogger(__name__)

AI_ENGINE_URL: str = os.getenv(
    "AI_ENGINE_URL",
    "http://localhost:8002",
)

INTERNAL_SERVICE_KEY: str | None = os.getenv("INTERNAL_SERVICE_KEY")

AI_ENGINE_TIMEOUT: float = float(os.getenv("AI_ENGINE_TIMEOUT", "5.0"))


def unavailable_analysis(error: Exception | str | None = None) -> AIAnalysisResponse:
    """
    Constructs an advisory fallback response when AI analysis cannot be performed.

    The AI is strictly advisory; this fallback guarantees that the deterministic
    Policy Engine can proceed uninterrupted with rule-based evaluation.
    """
    error_evidence: list[str] = []
    if isinstance(error, Exception):
        error_evidence.append(f"error_type:{type(error).__name__}")
    elif isinstance(error, str):
        error_evidence.append(f"error_detail:{error}")

    return AIAnalysisResponse(
        risk_level="unknown",
        risk_score=50,
        flags=[
            "ai_analysis_unavailable",
            "fallback_triggered",
        ],
        explanation=(
            "AI risk analysis is unavailable due to connection failure, "
            "timeout, or provider error. The deterministic Policy Engine "
            "remains the sole authority."
        ),
        evidence=error_evidence,
        analysis_available=False,
        model_used=None,
        latency_ms=None,
    )


async def evaluate_risk(
    operation: OperationRequest,
    policy: PolicyResponse,
    agent_id: str,
) -> AIAnalysisResponse:
    """
    Asynchronously queries the AI Engine for operation risk advisory.

    Parameters:
        operation: Evaluated operation input.
        policy: Associated active policy.
        agent_id: Authenticated agent ID derived from API Key.

    Returns:
        AIAnalysisResponse with advisory score, flags, and explanation,
        or a fallback 'unknown' structure if the microservice is unreachable.
    """
    url = f"{AI_ENGINE_URL.rstrip('/')}/analyze"

    headers: dict[str, str] = {
        "Content-Type": "application/json",
    }
    if INTERNAL_SERVICE_KEY:
        headers["X-Internal-Service-Key"] = INTERNAL_SERVICE_KEY

    payload: dict[str, Any] = {
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
    }

    try:
        async with httpx.AsyncClient(timeout=AI_ENGINE_TIMEOUT) as client:
            response = await client.post(
                url,
                json=payload,
                headers=headers,
            )
            response.raise_for_status()
            data = response.json()
            return AIAnalysisResponse.model_validate(data)

    except httpx.TimeoutException as exc:
        logger.warning("AI Engine request timed out after %s seconds: %s", AI_ENGINE_TIMEOUT, exc)
        return unavailable_analysis(exc)

    except httpx.HTTPStatusError as exc:
        logger.warning(
            "AI Engine returned HTTP error %s: %s",
            exc.response.status_code,
            exc.response.text,
        )
        return unavailable_analysis(exc)

    except httpx.RequestError as exc:
        logger.warning("Failed to connect to AI Engine at %s: %s", url, exc)
        return unavailable_analysis(exc)

    except Exception as exc:
        logger.exception("Unexpected error while communicating with AI Engine: %s", exc)
        return unavailable_analysis(exc)


# Backward-compatible alias
analyze_with_ai = evaluate_risk
