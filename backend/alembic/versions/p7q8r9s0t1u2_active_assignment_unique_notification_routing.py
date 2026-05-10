"""Single active assignment per letter + notification routing metadata.

Revision ID: p7q8r9s0t1u2
Revises: p6q7r8s9t0u1
Create Date: 2026-05-11

- De-duplicates multiple active letter_assignments per letter (keeps highest id).
- Partial unique index: one active row per letter_id.
- Adds notifications.event_code, route_module, entity_type, entity_id for stable deep links.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "p7q8r9s0t1u2"
down_revision: Union[str, Sequence[str], None] = "p6q7r8s9t0u1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    # --- notifications: routing metadata (nullable for backward compatibility)
    op.add_column("notifications", sa.Column("event_code", sa.String(length=64), nullable=True))
    op.add_column("notifications", sa.Column("route_module", sa.String(length=32), nullable=True))
    op.add_column("notifications", sa.Column("entity_type", sa.String(length=64), nullable=True))
    op.add_column("notifications", sa.Column("entity_id", sa.Integer(), nullable=True))

    # Best-effort backfill from kind + link_path for existing rows (portable SQL)
    op.execute(
        sa.text(
            """
            UPDATE notifications SET
              route_module = 'assignment',
              event_code = 'assignment.new',
              entity_type = 'letter',
              entity_id = letter_id
            WHERE kind = 'assignment' AND route_module IS NULL
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE notifications SET
              route_module = 'assignment',
              event_code = 'assignment.transfer',
              entity_type = 'letter',
              entity_id = letter_id
            WHERE kind = 'reassignment' AND route_module IS NULL
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE notifications SET
              route_module = 'closure',
              event_code = 'letter.closed',
              entity_type = 'letter',
              entity_id = letter_id
            WHERE kind = 'letter_closed' AND route_module IS NULL
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE notifications SET
              route_module = CASE
                WHEN link_path LIKE '/dashboard/approval/%' THEN 'approval'
                WHEN link_path LIKE '/dashboard/assignment/%' THEN 'assignment'
                WHEN link_path LIKE '/dashboard/consultant/%' THEN 'consultant'
                WHEN link_path LIKE '/dashboard/closure/%' THEN 'closure'
                ELSE NULL
              END,
              event_code = CASE
                WHEN title LIKE 'New received letter:%' THEN 'letter.received'
                WHEN title LIKE '%Consultant resolved%' THEN 'consultant.resolved'
                WHEN title LIKE '%routed:%' OR title LIKE 'Letter routed%' OR title LIKE 'Department assigned%' THEN 'letter.routed'
                ELSE 'system.generic'
              END,
              entity_type = CASE WHEN letter_id IS NOT NULL THEN 'letter' ELSE NULL END,
              entity_id = letter_id
            WHERE kind = 'system' AND route_module IS NULL
            """
        )
    )

    # --- letter_assignments: deactivate older duplicates (keep max(id) per letter)
    if dialect == "postgresql":
        op.execute(
            sa.text(
                """
                UPDATE letter_assignments AS la
                SET is_active = false,
                    work_status = 'transferred',
                    updated_at = NOW()
                WHERE la.is_active IS TRUE
                  AND EXISTS (
                    SELECT 1 FROM letter_assignments la2
                    WHERE la2.letter_id = la.letter_id
                      AND la2.is_active IS TRUE
                      AND la2.id > la.id
                  )
                """
            )
        )
    else:
        op.execute(
            sa.text(
                """
                UPDATE letter_assignments
                SET is_active = 0,
                    work_status = 'transferred',
                    updated_at = datetime('now')
                WHERE is_active = 1
                  AND EXISTS (
                    SELECT 1 FROM letter_assignments AS la2
                    WHERE la2.letter_id = letter_assignments.letter_id
                      AND la2.is_active = 1
                      AND la2.id > letter_assignments.id
                  )
                """
            )
        )

    # Partial unique index (PostgreSQL + SQLite)
    if dialect == "postgresql":
        op.create_index(
            "uq_letter_assignments_one_active_per_letter",
            "letter_assignments",
            ["letter_id"],
            unique=True,
            postgresql_where=sa.text("is_active IS TRUE"),
        )
    else:
        op.execute(
            sa.text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_letter_assignments_one_active_per_letter "
                "ON letter_assignments (letter_id) WHERE is_active = 1"
            )
        )


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    if dialect == "postgresql":
        op.drop_index("uq_letter_assignments_one_active_per_letter", table_name="letter_assignments")
    else:
        op.execute(sa.text("DROP INDEX IF EXISTS uq_letter_assignments_one_active_per_letter"))

    op.drop_column("notifications", "entity_id")
    op.drop_column("notifications", "entity_type")
    op.drop_column("notifications", "route_module")
    op.drop_column("notifications", "event_code")
