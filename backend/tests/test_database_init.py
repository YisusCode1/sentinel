from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from app import init_db
from app.core.database import Base


def test_empty_database_bootstrap_and_repeat(tmp_path, monkeypatch):
    url = f"sqlite:///{(tmp_path / 'bootstrap.db').as_posix()}"
    engine = create_engine(url)
    monkeypatch.setenv("DATABASE_URL", url)
    monkeypatch.setattr(init_db, "engine", engine)
    init_db.main()
    init_db.main()
    assert "ai_analysis" in {column["name"] for column in inspect(engine).get_columns("operations")}
    with engine.connect() as db:
        assert db.scalar(text("SELECT version_num FROM alembic_version")) == "80a1574d3cd6"
    engine.dispose()


def test_upgrade_adds_nullable_analysis_and_preserves_records(tmp_path, monkeypatch):
    url = f"sqlite:///{(tmp_path / 'upgrade.db').as_posix()}"
    engine = create_engine(url)
    Base.metadata.create_all(engine)
    with engine.begin() as db:
        db.execute(text("DROP INDEX ix_operations_agent_created"))
        db.execute(text("ALTER TABLE operations DROP COLUMN ai_analysis"))
        db.execute(text("INSERT INTO agents (id, name, active, created_at) VALUES ('retained', 'Existing agent', 1, CURRENT_TIMESTAMP)"))
    monkeypatch.setenv("DATABASE_URL", url)
    monkeypatch.setattr(init_db, "engine", engine)
    command.stamp(Config("alembic.ini"), "024dc6e5ee59")
    init_db.main()
    with engine.connect() as db:
        assert db.scalar(text("SELECT name FROM agents WHERE id = 'retained'")) == "Existing agent"
    assert "ai_analysis" in {column["name"] for column in inspect(engine).get_columns("operations")}
    engine.dispose()
