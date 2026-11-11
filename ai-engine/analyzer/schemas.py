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


class GeminiProviderSchema(GeminiStructuredOutput):
    """Provider-compatible schema; strict validation still uses GeminiStructuredOutput."""
    model_config = ConfigDict(extra="ignore", strict=True)


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class SavedOperation(BaseModel):
    id: str
    decision: Literal["approved", "rejected"]
    reason: str
    amount: str | float | Decimal
    token: str
    recipient: str
    policy_id: str
    ai_analysis: RiskAnalysisResponse | None = None


class ActivePolicy(BaseModel):
    id: str
    name: str
    max_amount: str | float | Decimal
    allowed_tokens: list[str]
    allowed_recipients: list[str]
    allowed_operations: list[str]
    active: bool = True


class ContextAgent(BaseModel):
    id: str
    name: str
    active: bool


class AssistantContext(BaseModel):
    scope: str = "authenticated_agent_only"
    agents: list[ContextAgent] = Field(default_factory=list, max_length=1)
    operations: list[SavedOperation] = Field(default_factory=list, max_length=20)
    policies: list[ActivePolicy] = Field(default_factory=list, max_length=20)
    selected_operation: SavedOperation | None = None


class AssistantRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    message: str = Field(min_length=1, max_length=2000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=12)
    context: AssistantContext = Field(default_factory=AssistantContext)


class AssistantOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reply: str = Field(min_length=1, max_length=8000)
    suggested_rules: list[str] = Field(default_factory=list, max_length=6)


class AssistantProviderSchema(AssistantOutput):
    """Gemini response schema without unsupported additionalProperties."""
    model_config = ConfigDict(extra="ignore")


class AssistantResponse(AssistantOutput):
    mode: Literal["llm", "demo", "unavailable"]
    model_used: str | None = None
    warnings: list[str] = Field(default_factory=list)
