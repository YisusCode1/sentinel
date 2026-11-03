from decimal import Decimal

import pytest
from pydantic import ValidationError

from analyzer.schemas import (
    GeminiStructuredOutput,
    OperationAnalysisRequest,
    RiskAnalysisResponse,
)


@pytest.mark.parametrize("amount", ["40", 40.5, Decimal("40.123456789123456789")])
def test_backend_operation_contract(amount):
    request = OperationAnalysisRequest(
        agent_id="sentinel-demo-agent",
        policy_id="policy-001",
        operation="transfer",
        token="USDC",
        amount=amount,
        recipient="demo-recipient",
    )
    assert request.amount == amount
    assert request.network == "near-testnet"
    assert request.metadata is None


@pytest.mark.parametrize("score", [-1, 101, "72", True, 72.5])
def test_gemini_rejects_invalid_scores(score):
    with pytest.raises(ValidationError):
        GeminiStructuredOutput(risk_score=score, risk_level="high", explanation="Anomaly")


@pytest.mark.parametrize("score", [0, 100])
def test_gemini_accepts_score_boundaries_and_independent_defaults(score):
    first = GeminiStructuredOutput(risk_score=score, risk_level="low", explanation="Context")
    second = GeminiStructuredOutput(risk_score=score, risk_level="low", explanation="Context")
    first.flags.append("new_recipient")
    assert second.flags == []
    assert second.evidence == []


@pytest.mark.parametrize("extra", [{"decision": "approved"}, {"risk_level": "unknown"}])
def test_gemini_rejects_decisions_and_unknown_level(extra):
    payload = {"risk_score": 50, "risk_level": "medium", "explanation": "Context"}
    payload.update(extra)
    with pytest.raises(ValidationError):
        GeminiStructuredOutput(**payload)


def test_backend_response_can_express_unavailable_analysis():
    response = RiskAnalysisResponse(
        risk_score=0,
        risk_level="unknown",
        flags=[],
        explanation="Analysis unavailable",
        evidence=[],
        analysis_available=False,
    )
    assert response.analysis_available is False
    assert response.model_used is None


@pytest.mark.parametrize("score", [-1, 101])
def test_backend_response_rejects_out_of_range_scores(score):
    with pytest.raises(ValidationError):
        RiskAnalysisResponse(
            risk_score=score, risk_level="low", flags=[], explanation="Context", evidence=[]
        )
