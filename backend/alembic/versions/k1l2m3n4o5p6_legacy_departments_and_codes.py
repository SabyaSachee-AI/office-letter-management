"""Mark legacy departments; ensure standard workflow departments exist."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "k1l2m3n4o5p6"
down_revision: Union[str, Sequence[str], None] = "i9j0k1l2m3n4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
            UPDATE departments
            SET is_legacy = true
            WHERE code IN ('GA', 'HR', 'FIN')
               OR LOWER(name) IN (
                   'general administration',
                   'human resources',
                   'finance'
               )
            """
        )
    )
    standard = [
        ("Technical", "TECH", 1),
        ("Functional", "FUNC", 2),
        ("Administration", "ADM", 3),
        ("Others", "OTH", 4),
    ]
    for name, code, so in standard:
        exists = bind.execute(
            sa.text("SELECT id FROM departments WHERE code = :c LIMIT 1"),
            {"c": code},
        ).scalar()
        if exists is None:
            bind.execute(
                sa.text(
                    "INSERT INTO departments (name, code, sort_order, is_legacy) "
                    "VALUES (:n, :c, :so, false)"
                ),
                {"n": name, "c": code, "so": so},
            )


def downgrade() -> None:
    pass
