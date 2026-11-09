from datetime import datetime, timezone

from fastapi import Depends, HTTPException
from fastapi.security import APIKeyHeader
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    API_KEY_PREFIX,
    get_key_prefix,
    verify_api_key,
)
from app.models import Agent, AgentAPIKey


api_key_header = APIKeyHeader(
    name="X-API-Key",
    auto_error=False,
)


def get_authenticated_agent(
    api_key: str | None = Depends(api_key_header),
    db: Session = Depends(get_db),
) -> Agent:

    unauthorized = HTTPException(
        status_code=401,
        detail="Invalid or inactive API key",
        headers={"WWW-Authenticate": "ApiKey"},
    )

    if not api_key or not api_key.startswith(API_KEY_PREFIX):
        raise unauthorized

    prefix = get_key_prefix(api_key)

    keys = db.scalars(
        select(AgentAPIKey).where(
            AgentAPIKey.key_prefix == prefix,
            AgentAPIKey.active.is_(True),
        )
    ).all()

    now = datetime.now(timezone.utc)

    authenticated_key = None

    for key in keys:
        if key.expires_at is not None and key.expires_at <= now:
            continue

        if verify_api_key(api_key, key.key_hash):
            authenticated_key = key
            break

    if authenticated_key is None:
        raise unauthorized

    agent = db.get(Agent, authenticated_key.agent_id)

    if agent is None or not agent.active:
        raise unauthorized

    # Registrar el último uso después de validar la credencial.
    db.execute(
        AgentAPIKey.__table__.update()
        .where(AgentAPIKey.id == authenticated_key.id)
        .values(last_used_at=now)
    )
    db.commit()

    return agent
