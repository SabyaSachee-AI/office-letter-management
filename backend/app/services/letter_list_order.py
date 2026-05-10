"""Shared ordering for letter lists: newest workflow activity first."""

from sqlalchemy import func, select

from app.models.letter import Letter, LetterAction


def last_letter_action_subquery():
    """Per-letter max timestamp of any workflow row in ``letter_actions``."""
    return (
        select(
            LetterAction.letter_id.label("lid"),
            func.max(LetterAction.created_at).label("last_action_at"),
        )
        .group_by(LetterAction.letter_id)
        .subquery()
    )


def apply_letters_newest_activity_order(stmt):
    """Append outer join + ``ORDER BY`` for newest-first letter ordering.

    ``stmt`` must be a ``select(Letter)`` (with optional prior ``where`` / ``options``).
    """
    sq = last_letter_action_subquery()
    return stmt.outerjoin(sq, sq.c.lid == Letter.id).order_by(
        func.coalesce(sq.c.last_action_at, Letter.created_at).desc(),
        Letter.id.desc(),
    )
