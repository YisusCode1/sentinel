import argparse
import os
import sys

from sqlalchemy.exc import IntegrityError

from app.core.database import SessionLocal
from app.services.agent_service import (
    create_agent,
    list_agents,
    rotate_api_key,
    revoke_api_key,
)


def require_production_confirmation(args):
    environment = os.getenv("SENTINEL_ENV", "").strip().lower()

    if environment in ("development", "test"):
        return

    if environment == "production":
        if not args.confirm_production:
            raise RuntimeError(
                "Production mutation requires "
                "--confirm-production"
            )
        return

    raise RuntimeError(
        "SENTINEL_ENV must be explicitly set to "
        "development, test, or production. "
        "Mutation blocked."
    )


def execute(args):
    with SessionLocal() as db:

        if args.agent_command == "create":
            require_production_confirmation(args)

            result = create_agent(db, args.name)

            print("\nAGENT CREATED")
            print("ID:", result["agent_id"])
            print("NAME:", result["name"])
            print("KEY ID:", result["key_id"])
            print("\nAPI KEY (DISPLAYED ONCE):")
            print(result["api_key"])

        elif args.agent_command == "list":
            agents = list_agents(db)

            if not agents:
                print("No agents registered.")
                return

            for agent in agents:
                print(
                    f"ID: {agent['id']} | "
                    f"NAME: {agent['name']} | "
                    f"ACTIVE: {agent['active']} | "
                    f"ACTIVE KEYS: {agent['active_keys']}"
                )

        elif args.agent_command == "key":
            require_production_confirmation(args)

            if args.key_command == "rotate":
                result = rotate_api_key(
                    db,
                    args.agent_id,
                )

                print("\nAPI KEY ROTATED")
                print("AGENT ID:", result["agent_id"])
                print("KEY ID:", result["key_id"])
                print("\nNEW API KEY (DISPLAYED ONCE):")
                print(result["api_key"])

            elif args.key_command == "revoke":
                result = revoke_api_key(
                    db,
                    args.key_id,
                )

                print("API KEY REVOKED")
                print("KEY ID:", result["key_id"])
                print("AGENT ID:", result["agent_id"])


def build_parser():
    parser = argparse.ArgumentParser(
        prog="sentinel",
        description="Sentinel AI Administration CLI",
    )

    parser.add_argument(
        "--confirm-production",
        action="store_true",
        help="Confirm intentional production mutation",
    )

    commands = parser.add_subparsers(
        dest="resource",
        required=True,
    )

    agent = commands.add_parser("agent")
    agent_commands = agent.add_subparsers(
        dest="agent_command",
        required=True,
    )

    create = agent_commands.add_parser("create")
    create.add_argument("--name", required=True)

    agent_commands.add_parser("list")

    key = agent_commands.add_parser("key")
    key_commands = key.add_subparsers(
        dest="key_command",
        required=True,
    )

    rotate = key_commands.add_parser("rotate")
    rotate.add_argument("agent_id")

    revoke = key_commands.add_parser("revoke")
    revoke.add_argument("key_id")

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    try:
        execute(args)

    except (ValueError, IntegrityError, RuntimeError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
