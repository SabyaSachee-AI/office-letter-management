"""letters memo_no optional indexed

Revision ID: g1h2i3j4k5l6
Revises: f8a1b2c3d4e5
Create Date: 2026-05-06

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "g1h2i3j4k5l6"
down_revision: Union[str, Sequence[str], None] = "f8a1b2c3d4e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "letters",
        sa.Column("memo_no", sa.String(length=160), nullable=True),
    )
    op.create_index(op.f("ix_letters_memo_no"), "letters", ["memo_no"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_letters_memo_no"), table_name="letters")
    op.drop_column("letters", "memo_no")
