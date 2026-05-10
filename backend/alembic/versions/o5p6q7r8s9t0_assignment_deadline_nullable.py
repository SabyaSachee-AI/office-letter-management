"""Make letter_assignments.deadline_at optional for universal routing.

Revision ID: o5p6q7r8s9t0
Revises: n4o5p6q7r8s9
Create Date: 2026-05-11
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "o5p6q7r8s9t0"
down_revision: Union[str, Sequence[str], None] = "n4o5p6q7r8s9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "letter_assignments",
        "deadline_at",
        existing_type=sa.DateTime(timezone=True),
        nullable=True,
    )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        op.execute(
            sa.text(
                "UPDATE letter_assignments SET deadline_at = datetime('now', '+365 days') "
                "WHERE deadline_at IS NULL"
            )
        )
    else:
        op.execute(
            sa.text(
                "UPDATE letter_assignments SET deadline_at = NOW() + interval '365 days' "
                "WHERE deadline_at IS NULL"
            )
        )
    op.alter_column(
        "letter_assignments",
        "deadline_at",
        existing_type=sa.DateTime(timezone=True),
        nullable=False,
    )
