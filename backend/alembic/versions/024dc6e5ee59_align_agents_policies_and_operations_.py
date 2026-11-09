"""align agents policies and operations schema

Revision ID: 024dc6e5ee59
Revises:
Create Date: 2026-11-08
"""

from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "024dc6e5ee59"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    connection = op.get_bind()

    # ---------------------------------------------------------
    # 1. VALIDACIONES: no modificar el esquema si hay anomalías
    # ---------------------------------------------------------

    orphan_count = connection.execute(
        sa.text("""
            SELECT COUNT(*)
            FROM operations o
            LEFT JOIN policies p ON p.id = o.policy_id
            WHERE p.id IS NULL
        """)
    ).scalar_one()

    if orphan_count:
        raise RuntimeError(
            f"Migration aborted: {orphan_count} operations "
            "reference policies that do not exist."
        )

    invalid_agent_count = connection.execute(
        sa.text("""
            SELECT COUNT(*)
            FROM operations
            WHERE agent_id IS NULL
            OR LENGTH(agent_id) > 36
            OR BTRIM(agent_id) = ''
        """)
    ).scalar_one()

    if invalid_agent_count:
        raise RuntimeError(
            f"Migration aborted: {invalid_agent_count} operations "
            "have an invalid agent_id."
        )

    policy_rows = connection.execute(
        sa.text("""
            SELECT
                p.id,
                COUNT(DISTINCT o.agent_id) AS agent_count,
                MIN(o.agent_id) AS agent_id
            FROM policies p
            LEFT JOIN operations o ON o.policy_id = p.id
            GROUP BY p.id
            ORDER BY p.id
        """)
    ).mappings().all()

    for policy in policy_rows:
        if policy["agent_count"] != 1:
            raise RuntimeError(
                "Migration aborted: policy "
                f"{policy['id']} has {policy['agent_count']} distinct "
                "agents. Exactly one is required."
            )

    historical_agents = connection.execute(
        sa.text("""
            SELECT DISTINCT agent_id
            FROM operations
            ORDER BY agent_id
        """)
    ).scalars().all()

    # ---------------------------------------------------------
    # 2. CREAR AGENTS Y CONSERVAR LOS IDENTIFICADORES HISTÓRICOS
    # ---------------------------------------------------------

    op.create_table(
        "agents",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_agents_name"),
    )

    now = datetime.now(timezone.utc)

    for agent_id in historical_agents:
        connection.execute(
            sa.text("""
                INSERT INTO agents (id, name, active, created_at)
                VALUES (:id, :name, TRUE, :created_at)
            """),
            {
                "id": agent_id,
                "name": agent_id,
                "created_at": now,
            },
        )

    # ---------------------------------------------------------
    # 3. ASOCIAR CADA POLÍTICA CON SU AGENTE HISTÓRICO
    # ---------------------------------------------------------

    op.add_column(
        "policies",
        sa.Column("agent_id", sa.String(length=36), nullable=True),
    )

    connection.execute(
        sa.text("""
            UPDATE policies AS p
            SET agent_id = (
                SELECT MIN(o.agent_id)
                FROM operations AS o
                WHERE o.policy_id = p.id
            )
        """)
    )

    op.alter_column(
        "policies",
        "agent_id",
        existing_type=sa.String(length=36),
        nullable=False,
    )

    op.create_index(
        "ix_policies_agent_id",
        "policies",
        ["agent_id"],
    )

    op.create_foreign_key(
        "fk_policies_agent_id_agents",
        "policies",
        "agents",
        ["agent_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    op.create_unique_constraint(
        "uq_policies_id_agent_id",
        "policies",
        ["id", "agent_id"],
    )

    # ---------------------------------------------------------
    # 4. AJUSTAR OPERATIONS Y CREAR SUS RELACIONES
    # ---------------------------------------------------------

    op.alter_column(
        "operations",
        "agent_id",
        existing_type=sa.String(length=100),
        type_=sa.String(length=36),
        existing_nullable=False,
        postgresql_using="agent_id::varchar(36)",
    )

    op.create_index(
        "ix_operations_agent_id",
        "operations",
        ["agent_id"],
    )

    op.create_foreign_key(
        "fk_operations_agent_id_agents",
        "operations",
        "agents",
        ["agent_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    op.create_foreign_key(
        "fk_operations_policy_agent",
        "operations",
        "policies",
        ["policy_id", "agent_id"],
        ["id", "agent_id"],
        ondelete="RESTRICT",
    )

    # ---------------------------------------------------------
    # 5. CREAR AGENT_API_KEYS SIN GENERAR CLAVES
    # ---------------------------------------------------------

    op.create_table(
        "agent_api_keys",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("agent_id", sa.String(length=36), nullable=False),
        sa.Column("key_prefix", sa.String(length=32), nullable=False),
        sa.Column("key_hash", sa.String(length=64), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["agent_id"],
            ["agents.id"],
            name="fk_agent_api_keys_agent_id_agents",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key_hash", name="uq_agent_api_keys_key_hash"),
    )

    op.create_index(
        "ix_agent_api_keys_agent_id",
        "agent_api_keys",
        ["agent_id"],
    )

    op.create_index(
        "ix_agent_api_keys_key_prefix",
        "agent_api_keys",
        ["key_prefix"],
    )


def downgrade() -> None:
    connection = op.get_bind()

    # No eliminar asociaciones de políticas creadas después
    # de esta migración.
    unexpected_policies = connection.execute(
        sa.text("""
            SELECT COUNT(*)
            FROM policies
            WHERE id <> :historical_policy_id
               OR agent_id <> :historical_agent_id
        """),
        {
            "historical_policy_id": "74917392-8e97-46b7-a685-56bfe3a2701a",
            "historical_agent_id": "agent-001",
        },
    ).scalar_one()

    if unexpected_policies:
        raise RuntimeError(
            "Downgrade aborted: policies contain associations "
            "that cannot be safely restored to the previous schema."
        )

    # No eliminar claves que hayan sido creadas después del upgrade.
    key_count = connection.execute(
        sa.text("SELECT COUNT(*) FROM agent_api_keys")
    ).scalar_one()

    if key_count:
        raise RuntimeError(
            "Downgrade aborted: agent_api_keys contains records. "
            "Preserve or export them before reversing this migration."
        )

    # No eliminar agentes nuevos creados después del upgrade.
    agent_rows = connection.execute(
        sa.text("SELECT id FROM agents ORDER BY id")
    ).scalars().all()

    if agent_rows != ["agent-001"]:
        raise RuntimeError(
            "Downgrade aborted: agents contains records beyond the "
            "single historical agent 'agent-001'."
        )

    # Retirar relaciones de operations.
    op.drop_constraint(
        "fk_operations_policy_agent",
        "operations",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_operations_agent_id_agents",
        "operations",
        type_="foreignkey",
    )
    op.drop_index("ix_operations_agent_id", table_name="operations")

    # Retirar relaciones de policies.
    op.drop_constraint(
        "uq_policies_id_agent_id",
        "policies",
        type_="unique",
    )
    op.drop_constraint(
        "fk_policies_agent_id_agents",
        "policies",
        type_="foreignkey",
    )
    op.drop_index("ix_policies_agent_id", table_name="policies")
    op.drop_column("policies", "agent_id")

    # Restaurar el tipo original de operations.agent_id.
    op.alter_column(
        "operations",
        "agent_id",
        existing_type=sa.String(length=36),
        type_=sa.String(length=100),
        existing_nullable=False,
        postgresql_using="agent_id::varchar(100)",
    )

    # La tabla está vacía; se puede retirar sin perder claves.
    op.drop_index(
        "ix_agent_api_keys_key_prefix",
        table_name="agent_api_keys",
    )
    op.drop_index(
        "ix_agent_api_keys_agent_id",
        table_name="agent_api_keys",
    )
    op.drop_table("agent_api_keys")

    op.drop_table("agents")
