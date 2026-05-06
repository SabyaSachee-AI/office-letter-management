"""rbac user profile departments role permissions

Revision ID: f8a1b2c3d4e5
Revises: e3dacdb0f699
Create Date: 2026-05-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f8a1b2c3d4e5"
down_revision: Union[str, Sequence[str], None] = "e3dacdb0f699"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "role_screen_permissions",
        sa.Column("role_id", sa.Integer(), nullable=False),
        sa.Column("screen_key", sa.String(length=64), nullable=False),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("role_id", "screen_key"),
    )

    op.add_column("roles", sa.Column("sort_order", sa.Integer(), nullable=False, server_default="100"))
    op.alter_column("roles", "name", type_=sa.String(length=80))

    op.add_column(
        "departments",
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="100"),
    )
    op.add_column(
        "departments",
        sa.Column("is_legacy", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    op.add_column("users", sa.Column("username", sa.String(length=80), nullable=True))
    op.add_column("users", sa.Column("employee_id", sa.String(length=64), nullable=True))
    op.add_column("users", sa.Column("nid", sa.String(length=32), nullable=True))
    op.add_column("users", sa.Column("phone_number", sa.String(length=32), nullable=True))
    op.add_column("users", sa.Column("designation", sa.String(length=120), nullable=True))
    op.add_column("users", sa.Column("approval_department_id", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("team_department_id", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("receiving_department_id", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("consultant_type", sa.String(length=120), nullable=True))
    op.add_column("users", sa.Column("reporting_team_leader_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_users_approval_department",
        "users",
        "departments",
        ["approval_department_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_users_team_department",
        "users",
        "departments",
        ["team_department_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_users_receiving_department",
        "users",
        "departments",
        ["receiving_department_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_users_reporting_team_leader",
        "users",
        "users",
        ["reporting_team_leader_id"],
        ["id"],
    )
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)

    bind = op.get_bind()

    bind.execute(
        sa.text("UPDATE roles SET name = 'System Admin' WHERE name = 'Admin'")
    )
    bind.execute(
        sa.text("UPDATE roles SET name = 'Approval Head-PEC' WHERE name = 'Approval Head'")
    )

    role_order = [
        ("Receiving Officer", 1),
        ("Approval Head-PEC", 2),
        ("Team Leader", 3),
        ("Consultant", 4),
        ("System Admin", 5),
    ]
    for name, so in role_order:
        bind.execute(
            sa.text("UPDATE roles SET sort_order = :so WHERE name = :n"),
            {"so": so, "n": name},
        )

    bind.execute(
        sa.text("UPDATE departments SET sort_order = 50, is_legacy = true WHERE name IN ('Finance', 'HR')")
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

    dialect = bind.dialect.name
    if dialect == "postgresql":
        bind.execute(
            sa.text(
                "UPDATE users SET username = split_part(email, '@', 1) WHERE username IS NULL"
            )
        )
    else:
        rows = bind.execute(sa.text("SELECT id, email FROM users WHERE username IS NULL")).fetchall()
        for row in rows or []:
            uid, em = row[0], row[1]
            local = (em or "user").split("@")[0].replace(" ", "_")[:80]
            bind.execute(
                sa.text("UPDATE users SET username = :u WHERE id = :id"),
                {"u": local or f"user_{uid}", "id": uid},
            )

    matrix = {
        "Receiving Officer": (
            "dashboard",
            "letters:view",
            "letters:create",
            "notifications",
        ),
        "Approval Head-PEC": (
            "dashboard",
            "letters:view",
            "approval",
            "notifications",
        ),
        "Team Leader": (
            "dashboard",
            "letters:view",
            "assignment",
            "closure",
            "notifications",
        ),
        "Consultant": (
            "dashboard",
            "consultant",
            "reports",
            "notifications",
        ),
        "System Admin": (
            "dashboard",
            "letters:view",
            "letters:create",
            "approval",
            "assignment",
            "consultant",
            "closure",
            "reports",
            "users",
            "notifications",
            "security",
            "role_management",
        ),
    }
    for rname, keys in matrix.items():
        rid = bind.execute(
            sa.text("SELECT id FROM roles WHERE name = :n LIMIT 1"), {"n": rname}
        ).scalar()
        if rid is None:
            continue
        for k in keys:
            bind.execute(
                sa.text(
                    "INSERT INTO role_screen_permissions (role_id, screen_key) VALUES (:r, :k)"
                ),
                {"r": rid, "k": k},
            )


def downgrade() -> None:
    op.drop_constraint("fk_users_reporting_team_leader", "users", type_="foreignkey")
    op.drop_constraint("fk_users_receiving_department", "users", type_="foreignkey")
    op.drop_constraint("fk_users_team_department", "users", type_="foreignkey")
    op.drop_constraint("fk_users_approval_department", "users", type_="foreignkey")
    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_column("users", "reporting_team_leader_id")
    op.drop_column("users", "consultant_type")
    op.drop_column("users", "receiving_department_id")
    op.drop_column("users", "team_department_id")
    op.drop_column("users", "approval_department_id")
    op.drop_column("users", "designation")
    op.drop_column("users", "phone_number")
    op.drop_column("users", "nid")
    op.drop_column("users", "employee_id")
    op.drop_column("users", "username")
    op.drop_column("departments", "is_legacy")
    op.drop_column("departments", "sort_order")
    op.drop_column("roles", "sort_order")
    op.drop_table("role_screen_permissions")
    op.alter_column("roles", "name", type_=sa.String(length=50))
