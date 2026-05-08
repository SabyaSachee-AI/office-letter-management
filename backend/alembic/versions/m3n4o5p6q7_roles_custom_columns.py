"""Roles: code, description, system/active flags, created_at for custom roles.

Revision ID: m3n4o5p6q7
Revises: k1l2m3n4o5p6
Create Date: 2026-05-08

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "m3n4o5p6q7"
down_revision: Union[str, Sequence[str], None] = "k1l2m3n4o5p6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("roles", sa.Column("code", sa.String(length=40), nullable=True))
    op.add_column("roles", sa.Column("description", sa.Text(), nullable=True))
    op.add_column(
        "roles",
        sa.Column(
            "is_system_role",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "roles",
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )
    op.add_column(
        "roles",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    bind = op.get_bind()
    mapping = [
        ("Receiving Officer", "RECEIVING_OFFICER"),
        ("Approval Head-PEC", "APPROVAL_HEAD_PEC"),
        ("Team Leader", "TEAM_LEADER"),
        ("Consultant", "CONSULTANT"),
        ("System Admin", "SYSTEM_ADMIN"),
    ]
    for name, code in mapping:
        bind.execute(
            sa.text(
                "UPDATE roles SET code = :code, is_system_role = :sys WHERE name = :name"
            ),
            {"code": code, "sys": True, "name": name},
        )

    bind.execute(sa.text("UPDATE roles SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL"))
    bind.execute(
        sa.text("UPDATE roles SET code = 'ROLE_' || CAST(id AS TEXT) WHERE code IS NULL")
    )

    op.alter_column("roles", "code", nullable=False)
    op.create_unique_constraint("uq_roles_code", "roles", ["code"])
    op.alter_column(
        "roles",
        "created_at",
        nullable=False,
        server_default=sa.text("CURRENT_TIMESTAMP"),
    )


def downgrade() -> None:
    op.drop_constraint("uq_roles_code", "roles", type_="unique")
    op.drop_column("roles", "created_at")
    op.drop_column("roles", "is_active")
    op.drop_column("roles", "is_system_role")
    op.drop_column("roles", "description")
    op.drop_column("roles", "code")
