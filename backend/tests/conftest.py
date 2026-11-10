import os

# Must run BEFORE importing app: never let tests touch the real database.
os.environ["DATABASE_URL"] = "sqlite://"

from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import generate_api_key, get_key_prefix, hash_api_key
from app.main import app
from app.models import Agent, AgentAPIKey, Policy

EVM = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"


@pytest.fixture()
def session_factory():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    yield sessionmaker(bind=engine, autocommit=False, autoflush=False)
    engine.dispose()


@pytest.fixture()
def client(session_factory):
    def override_get_db():
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def make_agent(session_factory):
    """Creates an agent with an API key and one policy. Returns a dict."""

    def _make(name: str):
        agent_id = str(uuid4())
        policy_id = str(uuid4())
        api_key = generate_api_key()
        db = session_factory()
        try:
            db.add(Agent(id=agent_id, name=name, active=True))
            db.flush()
            db.add(
                AgentAPIKey(
                    id=str(uuid4()),
                    agent_id=agent_id,
                    key_prefix=get_key_prefix(api_key),
                    key_hash=hash_api_key(api_key),
                    active=True,
                )
            )
            db.add(
                Policy(
                    id=policy_id,
                    agent_id=agent_id,
                    name=f"{name} policy",
                    max_amount=500,
                    allowed_tokens=["USDT"],
                    allowed_recipients=[EVM],
                    allowed_operations=["transfer"],
                    active=True,
                )
            )
            db.commit()
        finally:
            db.close()
        return {
            "agent_id": agent_id,
            "policy_id": policy_id,
            "api_key": api_key,
            "headers": {"X-API-Key": api_key},
        }

    return _make