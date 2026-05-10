"""Extend audit_logs with accountability columns.

Revision ID: n4o5p6q7r8s9
Revises: m3n4o5p6q7
Create Date: 2026-05-09
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "n4o5p6q7r8s9"
down_revision: Union[str, Sequence[str], None] = "m3n4o5p6q7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("audit_logs", sa.Column("user_name", sa.String(length=255), nullable=True))
    op.add_column("audit_logs", sa.Column("role", sa.String(length=255), nullable=True))
    op.add_column("audit_logs", sa.Column("module", sa.String(length=64), nullable=True))
    op.add_column("audit_logs", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("audit_logs", sa.Column("entity_type", sa.String(length=64), nullable=True))
    op.add_column("audit_logs", sa.Column("entity_id", sa.Integer(), nullable=True))
    op.add_column("audit_logs", sa.Column("old_value", sa.Text(), nullable=True))
    op.add_column("audit_logs", sa.Column("new_value", sa.Text(), nullable=True))

    op.create_index(op.f("ix_audit_logs_user_name"), "audit_logs", ["user_name"], unique=False)
    op.create_index(op.f("ix_audit_logs_role"), "audit_logs", ["role"], unique=False)
    op.create_index(op.f("ix_audit_logs_module"), "audit_logs", ["module"], unique=False)
    op.create_index(op.f("ix_audit_logs_entity_type"), "audit_logs", ["entity_type"], unique=False)
    op.create_index(op.f("ix_audit_logs_entity_id"), "audit_logs", ["entity_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_audit_logs_entity_id"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_entity_type"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_module"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_role"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_user_name"), table_name="audit_logs")

    op.drop_column("audit_logs", "new_value")
    op.drop_column("audit_logs", "old_value")
    op.drop_column("audit_logs", "entity_id")
    op.drop_column("audit_logs", "entity_type")
    op.drop_column("audit_logs", "description")
    op.drop_column("audit_logs", "module")
    op.drop_column("audit_logs", "role")
    op.drop_column("audit_logs", "user_name")
