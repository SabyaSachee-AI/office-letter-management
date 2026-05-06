"""create notices table

Revision ID: i9j0k1l2m3n4
Revises: h7i8j9k0l1m2
Create Date: 2026-05-06
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "i9j0k1l2m3n4"
down_revision: Union[str, Sequence[str], None] = "h7i8j9k0l1m2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notices",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_notices_id"), "notices", ["id"], unique=False)
    op.create_index(op.f("ix_notices_created_by"), "notices", ["created_by"], unique=False)
    op.create_index(op.f("ix_notices_created_at"), "notices", ["created_at"], unique=False)
    op.create_index(op.f("ix_notices_updated_at"), "notices", ["updated_at"], unique=False)
    op.create_index(op.f("ix_notices_expires_at"), "notices", ["expires_at"], unique=False)
    op.create_index(op.f("ix_notices_is_active"), "notices", ["is_active"], unique=False)
    op.create_index(op.f("ix_notices_is_pinned"), "notices", ["is_pinned"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_notices_is_pinned"), table_name="notices")
    op.drop_index(op.f("ix_notices_is_active"), table_name="notices")
    op.drop_index(op.f("ix_notices_expires_at"), table_name="notices")
    op.drop_index(op.f("ix_notices_updated_at"), table_name="notices")
    op.drop_index(op.f("ix_notices_created_at"), table_name="notices")
    op.drop_index(op.f("ix_notices_created_by"), table_name="notices")
    op.drop_index(op.f("ix_notices_id"), table_name="notices")
    op.drop_table("notices")
