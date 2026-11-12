from decimal import Decimal

import pytest

from app.models import Agent, AgentAPIKey
from app.schemas.operation import AIAnalysisResponse

EVM = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"


def op_payload(policy_id, **overrides):
    data = {
        "policy_id": policy_id,
        "network": "near",
        "operation": "transfer",
        "token": "USDT",
        "amount": "10",
        "recipient": EVM,
    }
    data.update(overrides)
    return data


POLICY_BODY = {
    "name": "Some policy",
    "max_amount": "100",
    "allowed_tokens": ["USDT"],
    "allowed_recipients": [EVM],
    "allowed_operations": ["transfer"],
}

PROTECTED = [
    ("get", "/api/v1/policies", None),
    ("get", "/api/v1/policies/some-id", None),
    ("post", "/api/v1/policies", POLICY_BODY),
    ("get", "/api/v1/operations", None),
    ("get", "/api/v1/operations/some-id", None),
    ("post", "/api/v1/operations/evaluate", op_payload("some-id")),
]


def low_risk_analysis(*args, **kwargs):
    return AIAnalysisResponse(
        risk_level="low",
        risk_score=10,
        flags=[],
        explanation="Looks normal.",
        evidence=[],
        analysis_available=True,
        model_used="test-model",
        latency_ms=5,
    )


# ---------- Authentication ----------

def test_health_is_public(client):
    assert client.get("/api/v1/health").status_code == 200


@pytest.mark.parametrize("method,path,body", PROTECTED)
def test_missing_key_is_401(client, method, path, body):
    response = getattr(client, method)(path, json=body) if body else getattr(client, method)(path)
    assert response.status_code == 401


@pytest.mark.parametrize("method,path,body", PROTECTED)
def test_invalid_key_is_401(client, method, path, body):
    headers = {"X-API-Key": "sntl_live_invalid"}
    kwargs = {"headers": headers}
    if body:
        kwargs["json"] = body
    assert getattr(client, method)(path, **kwargs).status_code == 401


def test_key_without_expected_prefix_is_401(client, make_agent):
    agent = make_agent("agent-a")
    response = client.get("/api/v1/policies", headers={"X-API-Key": "other_" + agent["api_key"]})
    assert response.status_code == 401


def test_inactive_key_is_401(client, make_agent, session_factory):
    agent = make_agent("agent-a")
    db = session_factory()
    db.query(AgentAPIKey).filter(AgentAPIKey.agent_id == agent["agent_id"]).update({"active": False})
    db.commit()
    db.close()
    assert client.get("/api/v1/policies", headers=agent["headers"]).status_code == 401


def test_inactive_agent_is_401(client, make_agent, session_factory):
    agent = make_agent("agent-a")
    db = session_factory()
    db.query(Agent).filter(Agent.id == agent["agent_id"]).update({"active": False})
    db.commit()
    db.close()
    assert client.get("/api/v1/policies", headers=agent["headers"]).status_code == 401


# ---------- Isolation between agents ----------

def test_list_policies_only_returns_own(client, make_agent):
    a = make_agent("agent-a")
    b = make_agent("agent-b")
    ids = [p["id"] for p in client.get("/api/v1/policies", headers=a["headers"]).json()]
    assert ids == [a["policy_id"]]
    assert b["policy_id"] not in ids


def test_cannot_read_other_agents_policy(client, make_agent):
    a = make_agent("agent-a")
    b = make_agent("agent-b")
    response = client.get(f"/api/v1/policies/{b['policy_id']}", headers=a["headers"])
    assert response.status_code == 404


def test_cannot_evaluate_with_other_agents_policy(client, make_agent):
    a = make_agent("agent-a")
    b = make_agent("agent-b")
    response = client.post(
        "/api/v1/operations/evaluate",
        json=op_payload(b["policy_id"]),
        headers=a["headers"],
    )
    assert response.status_code == 404


def test_history_and_detail_are_isolated(client, make_agent, monkeypatch):
    monkeypatch.setattr("app.main.analyze_with_ai", low_risk_analysis)
    a = make_agent("agent-a")
    b = make_agent("agent-b")

    created = client.post(
        "/api/v1/operations/evaluate",
        json=op_payload(a["policy_id"]),
        headers=a["headers"],
    ).json()

    assert client.get("/api/v1/operations", headers=b["headers"]).json() == []
    assert client.get(f"/api/v1/operations/{created['operation_id']}", headers=b["headers"]).status_code == 404
    assert client.get(f"/api/v1/operations/{created['operation_id']}", headers=a["headers"]).status_code == 200


def test_client_cannot_send_agent_id(client, make_agent):
    a = make_agent("agent-a")
    response = client.post(
        "/api/v1/operations/evaluate",
        json=op_payload(a["policy_id"], agent_id="someone-else"),
        headers=a["headers"],
    )
    assert response.status_code == 422


# ---------- Evaluation and AI ----------

def test_approved_operation_persists_ai_analysis(client, make_agent, monkeypatch):
    monkeypatch.setattr("app.main.analyze_with_ai", low_risk_analysis)
    a = make_agent("agent-a")

    result = client.post(
        "/api/v1/operations/evaluate",
        json=op_payload(a["policy_id"]),
        headers=a["headers"],
    ).json()
    assert result["decision"] == "approved"
    assert result["ai_analysis"]["risk_level"] == "low"

    stored = client.get(f"/api/v1/operations/{result['operation_id']}", headers=a["headers"]).json()
    assert stored["ai_analysis"]["model_used"] == "test-model"
    assert Decimal(stored["amount"]) == Decimal("10")


def test_rejected_operation_skips_ai(client, make_agent, monkeypatch):
    calls = []

    def spy(*args, **kwargs):
        calls.append(1)
        return low_risk_analysis()

    monkeypatch.setattr("app.main.analyze_with_ai", spy)
    a = make_agent("agent-a")

    result = client.post(
        "/api/v1/operations/evaluate",
        json=op_payload(a["policy_id"], amount="1000"),
        headers=a["headers"],
    ).json()

    assert result["decision"] == "rejected"
    assert result["reason"] == "Amount exceeds policy limit"
    assert result["ai_analysis"] is None
    assert calls == []


def test_ai_failure_does_not_break_evaluation(client, make_agent, monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError("AI engine down")

    monkeypatch.setattr("app.main.analyze_with_ai", boom)
    a = make_agent("agent-a")

    response = client.post(
        "/api/v1/operations/evaluate",
        json=op_payload(a["policy_id"]),
        headers=a["headers"],
    )
    assert response.status_code == 200
    body = response.json()
    assert body["decision"] == "approved"
    assert body["ai_analysis"]["risk_level"] == "unknown"
    assert body["ai_analysis"]["analysis_available"] is False