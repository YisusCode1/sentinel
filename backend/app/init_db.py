"""Bootstrap empty databases; migrate existing ones without deleting records."""
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect
from app.core.database import Base, engine
from app import models  # noqa: F401


def main():
    config = Config("alembic.ini")
    if not inspect(engine).get_table_names():
        Base.metadata.create_all(engine)
        command.stamp(config, "head")
    else:
        command.upgrade(config, "head")


if __name__ == "__main__":
    main()
