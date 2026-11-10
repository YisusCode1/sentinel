"""Database connection and session management.

Supports PostgreSQL in production / containerized environments and falls back
to SQLite for development or local test suites when DATABASE_URL is not set.
"""

import os
from pathlib import Path
from typing import Generator

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

load_dotenv()

DATABASE_URL: str | None = os.getenv("DATABASE_URL")

connect_args: dict[str, bool] = {}

if not DATABASE_URL:
    data_dir = Path(__file__).resolve().parent.parent.parent / "data"
    data_dir.mkdir(exist_ok=True)
    DATABASE_URL = f"sqlite:///{(data_dir / 'sentinel.db').as_posix()}"
    connect_args = {"check_same_thread": False}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Dependency yields database session scoped to request lifecycle."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
