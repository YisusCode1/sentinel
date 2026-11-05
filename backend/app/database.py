from datetime import datetime

from sqlalchemy import JSON, DateTime, String, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker


class Base(DeclarativeBase):
    pass


class PolicyRow(Base):
    __tablename__ = "policies"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    data: Mapped[dict] = mapped_column(JSON)


class OperationRow(Base):
    __tablename__ = "operations"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    decision: Mapped[str] = mapped_column(String(20), index=True)
    search_text: Mapped[str] = mapped_column(String(2048))
    idempotency_key: Mapped[str | None] = mapped_column(String(36), unique=True, nullable=True)
    request: Mapped[dict] = mapped_column(JSON)
    data: Mapped[dict] = mapped_column(JSON)


def connect_database(url: str):
    options = {"connect_args": {"check_same_thread": False, "timeout": 20}} if url.startswith("sqlite") else {}
    engine = create_engine(url, pool_pre_ping=True, **options)
    return engine, sessionmaker(engine, expire_on_commit=False)
