"""In-process HTTP integration: real authentication, SQL, backend and AI endpoints."""
import importlib.util
import os
from pathlib import Path
import sys

os.environ["DATABASE_URL"] = "sqlite://"
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "ai-engine"))
sys.path.insert(0, str(ROOT / "backend"))

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.main import app
from app.core.database import Base, get_db
from app.core.security import generate_api_key, get_key_prefix, hash_api_key
from app.models import Agent, AgentAPIKey, OperationRecord
from app.services import ai_client
from analyzer import service
from analyzer.config import AIEngineSettings

spec = importlib.util.spec_from_file_location("sentinel_ai_http", ROOT / "ai-engine/app/main.py")
ai_http = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ai_http)


@pytest.fixture
def system(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine)
    keys = [generate_api_key(), generate_api_key()]
    with sessions() as db:
        for i, key in enumerate(keys):
            db.add(Agent(id=f"agent-{i}", name=f"Agent {i}"))
            db.add(AgentAPIKey(id=f"key-{i}", agent_id=f"agent-{i}", key_prefix=get_key_prefix(key), key_hash=hash_api_key(key)))
        db.commit()
    def database():
        with sessions() as db:
            yield db
    app.dependency_overrides[get_db] = database
    settings = AIEngineSettings(_env_file=None, GEMINI_API_KEY=None, LLM_API_KEY=None,
                                INTERNAL_SERVICE_KEY="internal-test", AI_DEMO_FALLBACK=True)
    monkeypatch.setattr(service, "get_settings", lambda: settings)
    monkeypatch.setattr(ai_http, "get_settings", lambda: settings)
    monkeypatch.setattr(ai_client, "INTERNAL_SERVICE_KEY", "internal-test")
    captured = []
    with TestClient(ai_http.app) as ai, TestClient(app) as backend:
        def post(url, **kwargs):
            captured.append((url, kwargs["json"]))
            return ai.post("/assistant/chat" if url.endswith("/assistant/chat") else "/analyze",
                           json=kwargs["json"], headers=kwargs["headers"])
        monkeypatch.setattr(ai_client.httpx, "post", post)
        backend.headers["X-API-Key"] = keys[0]
        yield backend, keys, sessions, captured
    app.dependency_overrides.clear()
    engine.dispose()


def policy(client):
    response = client.post("/api/v1/policies", json={"name": "Demo policy", "max_amount": "100",
        "allowed_tokens": ["USDC"], "allowed_recipients": ["demo-recipient"], "allowed_operations": ["transfer"]})
    assert response.status_code == 200, response.text
    return response.json()["id"]


def operation(client, policy_id, amount="40"):
    response = client.post("/api/v1/operations/evaluate", json={"policy_id": policy_id, "network": "near-testnet",
        "operation": "transfer", "token": "USDC", "amount": amount, "recipient": "demo-recipient"})
    assert response.status_code == 200, response.text
    return response.json()


def test_end_to_end_approved_rejected_history_and_chat(system):
    client, _, sessions, captured = system
    pid = policy(client)
    accepted = operation(client, pid)
    rejected = operation(client, pid, "150")
    assert accepted["decision"] == "approved"
    assert rejected["decision"] == "rejected"
    assert "exceeds_policy_max_amount" in rejected["ai_analysis"]["flags"]
    records = client.get("/api/v1/operations").json()
    assert len(records) == 2
    assert all(record["ai_analysis"] for record in records)
    response = client.post("/api/v1/assistant/chat", json={"message": "Explica esta operación y sugiere reglas", "operation_id": rejected["operation_id"]})
    assert response.status_code == 200, response.text
    chat = response.json()
    assert chat["mode"] == "demo"
    assert rejected["operation_id"] in chat["reply"]
    assert "Amount exceeds policy limit" in chat["reply"]
    assert "prompt_injection_suspected" not in chat["warnings"]
    assert chat["suggested_rules"]
    assert captured[-1][1]["context"]["agents"][0]["id"] == "agent-0"
    assert "api_key" not in str(captured[-1][1])
    with sessions() as db:
        assert db.get(OperationRecord, rejected["operation_id"]).ai_analysis is not None


def test_isolation_and_authentication(system):
    client, keys, _, captured = system
    pid = policy(client)
    op = operation(client, pid)
    client.headers["X-API-Key"] = keys[1]
    assert client.get("/api/v1/policies").json() == []
    assert client.get("/api/v1/operations").json() == []
    assert client.post("/api/v1/assistant/chat", json={"message": "Explica", "operation_id": op["operation_id"]}).status_code == 404
    response = client.post("/api/v1/assistant/chat", json={"message": "Resumen"})
    assert response.status_code == 200
    assert captured[-1][1]["context"]["operations"] == []
    assert captured[-1][1]["context"]["agents"][0]["id"] == "agent-1"
    assert client.post("/api/v1/assistant/chat", json={"message": "Hola", "context": {}}).status_code == 422
    client.headers.pop("X-API-Key")
    assert client.post("/api/v1/assistant/chat", json={"message": "Hola"}).status_code == 401


def test_ai_outage_never_changes_policy_decisions(system, monkeypatch):
    client, _, _, _ = system
    pid = policy(client)
    def offline(*args, **kwargs):
        raise httpx.ConnectError("private-provider-detail")
    monkeypatch.setattr(ai_client.httpx, "post", offline)
    approved = operation(client, pid)
    rejected = operation(client, pid, "150")
    assert approved["decision"] == "approved" and rejected["decision"] == "rejected"
    assert approved["ai_analysis"]["analysis_available"] is False
    response = client.post("/api/v1/assistant/chat", json={"message": "Hola"}).json()
    assert response["mode"] == "unavailable"
    assert "private-provider-detail" not in str(response)
