"""Crea un agente y su API key.

Uso (desde la raíz del proyecto):
    docker compose exec backend python -m app.scripts.create_agent --name frontend-dev
    docker compose exec backend python -m app.scripts.create_agent --name demo-agent --demo-policy

La API key se muestra UNA sola vez. En la base de datos solo se guarda su hash.
"""

import argparse
import sys
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import select

from app.core.database import get_db
from app.core.security import generate_api_key, get_key_prefix, hash_api_key
from app.models import Agent, AgentAPIKey, Policy


def main() -> int:
    parser = argparse.ArgumentParser(description="Create a Sentinel agent and API key.")
    parser.add_argument("--name", required=True, help="Unique agent name (3-100 chars).")
    parser.add_argument(
        "--demo-policy",
        action="store_true",
        help="Also create a demo USDT transfer policy for this agent.",
    )
    args = parser.parse_args()

    name = args.name.strip()
    if not 3 <= len(name) <= 100:
        print("Error: --name must be between 3 and 100 characters.", file=sys.stderr)
        return 1

    # Plain values (not ORM attributes) so they stay readable after commit/close.
    agent_id = str(uuid4())
    policy_id = None
    api_key = generate_api_key()

    db = next(get_db())
    try:
        if db.scalar(select(Agent).where(Agent.name == name)) is not None:
            print(f"Error: an agent named '{name}' already exists.", file=sys.stderr)
            return 1

        db.add(Agent(id=agent_id, name=name, active=True))
        db.flush()  # the agent must exist before the key that references it

        db.add(
            AgentAPIKey(
                id=str(uuid4()),
                agent_id=agent_id,
                key_prefix=get_key_prefix(api_key),
                key_hash=hash_api_key(api_key),
                active=True,
            )
        )

        if args.demo_policy:
            policy_id = str(uuid4())
            db.add(
                Policy(
                    id=policy_id,
                    agent_id=agent_id,
                    name="Demo USDT Transfer Policy",
                    max_amount=Decimal("500"),
                    allowed_tokens=["USDT"],
                    allowed_recipients=["0x742d35Cc6634C0532925a3b844Bc454e4438f44e"],
                    allowed_operations=["transfer"],
                    active=True,
                )
            )

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    print("Agent created.")
    print(f"  agent_id : {agent_id}")
    if policy_id:
        print(f"  policy_id: {policy_id}")
    print()
    print("API key (shown ONCE, store it now):")
    print(f"  {api_key}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
