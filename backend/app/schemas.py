from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

Identifier = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=256)]
Amount = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^[0-9]{1,30}(\.[0-9]{1,24})?$", max_length=55)]


class PolicyCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Identifier
    max_amount: Amount
    allowed_tokens: list[Identifier] = Field(min_length=1, max_length=50)
    allowed_recipients: list[Identifier] = Field(min_length=1, max_length=50)
    allowed_operations: list[Identifier] = Field(min_length=1, max_length=50)

    @field_validator("max_amount")
    @classmethod
    def positive_limit(cls, value: str) -> str:
        if Decimal(value) <= 0:
            raise ValueError("El monto máximo debe ser mayor que cero")
        return value


class PolicyRecord(PolicyCreate):
    id: str
    created_at: str


class OperationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    agent_id: Identifier
    policy_id: Identifier
    network: Literal["near-testnet"]
    operation: Identifier
    token: Identifier
    amount: Amount
    recipient: Identifier

    @field_validator("amount")
    @classmethod
    def positive_amount(cls, value: str) -> str:
        if Decimal(value) <= 0:
            raise ValueError("El monto debe ser mayor que cero")
        return value


class PolicyCheck(BaseModel):
    code: str
    label: str
    passed: bool
    detail: str


class OperationRecord(OperationCreate):
    operation_id: str
    created_at: str
    decision: Literal["approved", "rejected"]
    reason: str
    policy_name: str
    policy_snapshot: PolicyRecord
    checks: list[PolicyCheck]
    risk_score: int | None = None
    risk_analysis_status: Literal["unavailable"] = "unavailable"
    requires_signature: bool | None = None
    verification_status: Literal["not_performed"] = "not_performed"
    execution_status: Literal["not_submitted"] = "not_submitted"


class OperationSummary(BaseModel):
    total: int
    approved: int
    rejected: int


class OperationPage(BaseModel):
    items: list[OperationRecord]
    total: int
    page: int
    page_size: int
    summary: OperationSummary
