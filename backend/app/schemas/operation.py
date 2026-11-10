"""Schemas for operation evaluation and audit records.

Enforces strict input validation with no client-supplied agent_id,
typed AI advisory risk analysis responses, and authoritative
Policy Engine decision outcomes.
"""

from datetime import datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class OperationRequest(BaseModel):
    """
    Operation evaluation request from the client.

    The client cannot supply an agent_id; identity is derived exclusively
    from the validated X-API-Key header. Extra fields are strictly forbidden.
    """

    model_config = ConfigDict(extra="forbid")

    policy_id: str = Field(
        ...,
        min_length=1,
        max_length=36,
        description="UUID of the policy against which the operation is evaluated",
    )
    network: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Target blockchain network, e.g. 'near-testnet'",
    )
    operation: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Operation name or method, e.g. 'transfer'",
    )
    token: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Token symbol or contract ID, e.g. 'USDC' or 'NEAR'",
    )
    amount: Decimal = Field(
        ...,
        gt=0,
        max_digits=20,
        decimal_places=8,
        description="Positive decimal amount for the operation",
    )
    recipient: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Target recipient account or address",
    )


# Alias aligned with frontend and client nomenclature
OperationInput = OperationRequest


class AIAnalysisResponse(BaseModel):
    """
    Structured advisory risk analysis from the AI Engine.

    The AI operates strictly as an advisor; risk scores and flags provide
    context and anomaly detection, but do not dictate policy approval or rejection.
    """

    risk_level: Literal["low", "medium", "high", "critical", "unknown"] = Field(
        ...,
        description="Advisory risk severity level",
    )
    risk_score: int = Field(
        ...,
        ge=0,
        le=100,
        description="Risk score between 0 (safe) and 100 (critical)",
    )
    flags: list[str] = Field(
        default_factory=list,
        description="Snake_case risk indicators, e.g. 'unusual_amount', 'new_recipient'",
    )
    explanation: str = Field(
        ...,
        description="Human-readable explanation of the risk assessment",
    )
    evidence: list[str] = Field(
        default_factory=list,
        description="Data points or signals that informed the flags",
    )
    analysis_available: bool = Field(
        default=True,
        description="Whether the AI engine successfully analyzed the operation",
    )
    model_used: str | None = Field(
        default=None,
        description="Gemini or underlying LLM model identifier",
    )
    latency_ms: int | None = Field(
        default=None,
        description="Execution latency in milliseconds",
    )


# Alias for AI analysis schema
AIAnalysis = AIAnalysisResponse


class OperationDecision(BaseModel):
    """
    Authoritative decision produced by the Policy Engine.

    The Policy Engine is the sole authority for 'approved' or 'rejected'.
    Advisory AI analysis is attached when available.
    """

    operation_id: str = Field(
        ...,
        description="Unique UUID generated for this evaluated operation",
    )
    decision: Literal["approved", "rejected", "flagged"] = Field(
        ...,
        description="Final verdict determined solely by the Policy Engine",
    )
    reason: str = Field(
        ...,
        description="Deterministic justification for the decision",
    )
    policy_id: str = Field(
        ...,
        description="UUID of the policy that evaluated the operation",
    )
    ai_analysis: AIAnalysisResponse | None = Field(
        default=None,
        description="Advisory AI risk analysis or fallback state",
    )


# Alias aligned with frontend nomenclature
OperationResult = OperationDecision


class OperationRecordResponse(BaseModel):
    """
    Historical operation record stored in the database.
    """

    model_config = ConfigDict(from_attributes=True)

    id: str
    agent_id: str
    policy_id: str
    network: str
    operation: str
    token: str
    amount: Decimal
    recipient: str
    decision: Literal["approved", "rejected", "flagged"]
    reason: str
    created_at: datetime
    ai_analysis: dict[str, Any] | AIAnalysisResponse | None = None
