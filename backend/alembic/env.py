from logging.config import fileConfig
from pathlib import Path
import sys

from sqlalchemy import create_engine, pool
from sqlalchemy.engine import Connection

from alembic import context

_backend_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_backend_root))

from app.core.config import settings  # noqa: E402
from app.db.base import Base  # noqa: E402

from app.models.activity import AuditLog, LoginLog, Notification  # noqa: E402, F401
from app.models.department import Department  # noqa: E402, F401
from app.models.letter import (  # noqa: E402, F401
    AssignmentSolutionFile,
    Letter,
    LetterAction,
    LetterAssignment,
)
from app.models.role import Role  # noqa: E402, F401
from app.models.user import User  # noqa: E402, F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = settings.database_url
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = create_engine(
        settings.database_url,
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        do_run_migrations(connection)


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
