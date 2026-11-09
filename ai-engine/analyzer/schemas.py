"""Typed operation inputs and advisory risk-analysis outputs."""

from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class OperationAnalysisRequest(BaseModel):
    """Backend operation fields with optional anomaly-analysis context."""

    agent_id: str
    policy_id: str
    network: str = Field(default="near-testnet")
    operation: str
    token: str
    amount: str | float | Decimal
    recipient: str

    policy_max_amount: str | float | Decimal | None = None
    allowed_recipients: list[str] | None = None
    allowed_tokens: list[str] | None = None
    historical_avg_amount: float | None = None
    is_new_recipient: bool | None = None
    recent_tx_count_1h: int | None = None
    metadata: dict[str, Any] | None = None


class GeminiStructuredOutput(BaseModel):
    """Strict advisory output schema for Gemini's response_schema."""

    model_config = ConfigDict(extra="forbid", strict=True)

    risk_score: int = Field(
        ...,
        ge=0,
        le=100,
        description="Advisory risk score from 0 (safe) to 100 (critical anomaly)",
    )
    risk_level: Literal["low", "medium", "high", "critical"]
    flags: list[str] = Field(
        default_factory=list,
        description="Short snake_case risk indicators, e.g., unusual_amount, new_recipient",
    )
    explanation: str = Field(
        ...,
        description="Explainable analysis of the operation context without approving or rejecting it",
    )
    evidence: list[str] = Field(
        default_factory=list,
        description="Concrete data points from the input that triggered the flags",
    )


class RiskAnalysisResponse(BaseModel):
    """Advisory analysis returned to backend orchestration."""

    risk_score: int = Field(..., ge=0, le=100)
    risk_level: Literal["low", "medium", "high", "critical", "unknown"]
    flags: list[str]
    explanation: str
    evidence: list[str]
    analysis_available: bool = True
    model_used: str | None = None
    latency_ms: int | None = Field(
        default=None, description="Execution time of the risk analysis in milliseconds"
    )
