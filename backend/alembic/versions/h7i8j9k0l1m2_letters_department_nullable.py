"""allow letters without department at intake

Revision ID: h7i8j9k0l1m2
Revises: g1h2i3j4k5l6
Create Date: 2026-05-06
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "h7i8j9k0l1m2"
down_revision: Union[str, Sequence[str], None] = "g1h2i3j4k5l6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("letters", "department_id", existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    op.alter_column("letters", "department_id", existing_type=sa.Integer(), nullable=False)
