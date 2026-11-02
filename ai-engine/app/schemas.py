
from typing import Literal

from pydantic import BaseModel, Field


class RiskAnalysisRequest(BaseModel):
    agent_id: str
    network: str
    operation: str
    token: str
    amount: str
    recipient: str


class RiskAnalysisResponse(BaseModel):
    risk_level: Literal["LOW", "MEDIUM", "HIGH"]
    risk_score: int = Field(ge=0, le=100)
    alerts: list[str]
    explanation: str
    recommendation: Literal["ALLOW", "REVIEW", "BLOCK"]
