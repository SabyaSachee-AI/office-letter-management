"""Use with SQLAlchemy Enum() so PostgreSQL stores Python enum *values* (e.g. active), not member names (ACTIVE)."""

import enum


def member_values(en: type[enum.Enum]) -> list[str]:
    return [m.value for m in en]
