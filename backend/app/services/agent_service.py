from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import func, select, or_
from sqlalchemy.orm import Session

from app.models import Agent, AgentAPIKey
from app.core.security import (
    generate_api_key,
    hash_api_key,
    get_key_prefix,
)


def create_agent(db: Session, name: str) -> dict:
    name = name.strip()

    if not 3 <= len(name) <= 100:
        raise ValueError(
            "Agent name must contain between 3 and 100 characters"
        )

    agent_id = str(uuid4())
    api_key = generate_api_key()

    with db.begin():
        agent = Agent(
            id=agent_id,
            name=name,
            active=True,
        )

        key = AgentAPIKey(
            id=str(uuid4()),
            agent_id=agent_id,
            key_prefix=get_key_prefix(api_key),
            key_hash=hash_api_key(api_key),
            active=True,
        )

        db.add(agent)
        db.add(key)
        db.flush()

    return {
        "agent_id": agent_id,
        "name": name,
        "key_id": key.id,
        "api_key": api_key,
    }


def list_agents(db: Session) -> list[dict]:
    now = datetime.now(timezone.utc)

    agents = db.scalars(
        select(Agent).order_by(Agent.created_at.desc())
    ).all()

    key_counts = dict(
        db.execute(
            select(
                AgentAPIKey.agent_id,
                func.count(AgentAPIKey.id),
            )
            .where(
                AgentAPIKey.active.is_(True),
                or_(
                    AgentAPIKey.expires_at.is_(None),
                    AgentAPIKey.expires_at > now,
                ),
            )
            .group_by(AgentAPIKey.agent_id)
        ).all()
    )

    return [
        {
            "id": agent.id,
            "name": agent.name,
            "active": agent.active,
            "created_at": agent.created_at,
            "active_keys": key_counts.get(agent.id, 0),
        }
        for agent in agents
    ]


def rotate_api_key(db: Session, agent_id: str) -> dict:
    new_api_key = generate_api_key()

    with db.begin():
        agent = db.execute(
            select(Agent)
            .where(Agent.id == agent_id)
            .with_for_update()
        ).scalar_one_or_none()

        if agent is None:
            raise ValueError("Agent not found")

        if not agent.active:
            raise ValueError("Agent is inactive")

        now = datetime.now(timezone.utc)

        db.query(AgentAPIKey).filter(
            AgentAPIKey.agent_id == agent_id,
            AgentAPIKey.active.is_(True),
        ).update(
            {
                AgentAPIKey.active: False,
                AgentAPIKey.expires_at: now,
            },
            synchronize_session=False,
        )

        new_key = AgentAPIKey(
            id=str(uuid4()),
            agent_id=agent_id,
            key_prefix=get_key_prefix(new_api_key),
            key_hash=hash_api_key(new_api_key),
            active=True,
        )

        db.add(new_key)
        db.flush()

    return {
        "agent_id": agent_id,
        "key_id": new_key.id,
        "api_key": new_api_key,
    }


def revoke_api_key(db: Session, key_id: str) -> dict:
    with db.begin():
        key = db.execute(
            select(AgentAPIKey)
            .where(AgentAPIKey.id == key_id)
            .with_for_update()
        ).scalar_one_or_none()

        if key is None:
            raise ValueError("API key not found")

        if not key.active:
            raise ValueError("API key already revoked")

        key.active = False
        key.expires_at = datetime.now(timezone.utc)

        agent_id = key.agent_id

        db.flush()

    return {
        "key_id": key_id,
        "agent_id": agent_id,
        "revoked": True,
    }
