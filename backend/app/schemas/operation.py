from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class OperationRequest(BaseModel):
    # El cliente no puede proporcionar agent_id.
    # La identidad se obtiene exclusivamente mediante X-API-Key.
    model_config = ConfigDict(extra="forbid")

    policy_id: str = Field(min_length=1, max_length=36)
    network: str = Field(min_length=1, max_length=100)
    operation: str = Field(min_length=1, max_length=100)
    token: str = Field(min_length=1, max_length=50)
    amount: Decimal = Field(gt=0, max_digits=20, decimal_places=8)
    recipient: str = Field(min_length=1, max_length=255)


class AIAnalysisResponse(BaseModel):
    risk_level: Literal[
        "low",
        "medium",
        "high",
        "critical",
        "unknown",
    ]

    risk_score: int = Field(ge=0, le=100)

    flags: list[str]
    explanation: str
    evidence: list[str]

    analysis_available: bool = True
    model_used: str | None = None
    latency_ms: int | None = None


class OperationDecision(BaseModel):
    operation_id: str
    decision: Literal["approved", "rejected"]
    reason: str
    policy_id: str
    ai_analysis: AIAnalysisResponse | None = None


class OperationRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    agent_id: str
    policy_id: str
    network: str
    operation: str
    token: str
    amount: Decimal
    recipient: str

    decision: Literal["approved", "rejected"]
    reason: str

    created_at: datetime
    ai_analysis: AIAnalysisResponse | None = None   # nuevo
