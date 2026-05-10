"""Placeholder revision so databases stamped at ``p6q7r8s9t0u1`` remain valid.

Some environments were left at revision ``p6q7r8s9t0u1`` (checkpoint naming) while the
matching file was never merged. This empty migration exists only to satisfy Alembic
lineage; real DDL for the next step lives in ``p7q8r9s0t1u2``.

Revision ID: p6q7r8s9t0u1
Revises: o5p6q7r8s9t0
Create Date: 2026-05-11
"""

from typing import Sequence, Union

from alembic import op

revision: str = "p6q7r8s9t0u1"
down_revision: Union[str, Sequence[str], None] = "o5p6q7r8s9t0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
