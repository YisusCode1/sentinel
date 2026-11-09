
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    JSON,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Agent(Base):
    __tablename__ = "agents"

    __table_args__ = (
        UniqueConstraint(
            "name",
            name="uq_agents_name",
        ),
    )

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class AgentAPIKey(Base):
    __tablename__ = "agent_api_keys"

    __table_args__ = (
        UniqueConstraint(
            "key_hash",
            name="uq_agent_api_keys_key_hash",
        ),
    )

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
    )

    agent_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(
            "agents.id",
            ondelete="CASCADE",
            name="fk_agent_api_keys_agent_id_agents",
        ),
        nullable=False,
        index=True,
    )

    key_prefix: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        index=True,
    )

    # Nunca almacenar la API Key original.
    key_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )

    active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    last_used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class Policy(Base):
    __tablename__ = "policies"

    __table_args__ = (
        UniqueConstraint(
            "id",
            "agent_id",
            name="uq_policies_id_agent_id",
        ),
    )

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
    )

    agent_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(
            "agents.id",
            ondelete="RESTRICT",
            name="fk_policies_agent_id_agents",
        ),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    max_amount: Mapped[Decimal] = mapped_column(
        Numeric(20, 8),
        nullable=False,
    )

    allowed_tokens: Mapped[list[str]] = mapped_column(
        JSON,
        nullable=False,
    )

    allowed_recipients: Mapped[list[str]] = mapped_column(
        JSON,
        nullable=False,
    )

    allowed_operations: Mapped[list[str]] = mapped_column(
        JSON,
        nullable=False,
    )

    active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )


class OperationRecord(Base):
    __tablename__ = "operations"

    __table_args__ = (
        ForeignKeyConstraint(
            ["policy_id", "agent_id"],
            ["policies.id", "policies.agent_id"],
            name="fk_operations_policy_agent",
            ondelete="RESTRICT",
        ),
    )

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
    )

    agent_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(
            "agents.id",
            ondelete="RESTRICT",
            name="fk_operations_agent_id_agents",
        ),
        nullable=False,
        index=True,
    )

    policy_id: Mapped[str] = mapped_column(
        String(36),
        nullable=False,
    )

    network: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    operation: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    token: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    amount: Mapped[Decimal] = mapped_column(
        Numeric(20, 8),
        nullable=False,
    )

    recipient: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    decision: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    reason: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
