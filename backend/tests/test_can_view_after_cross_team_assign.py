"""
Cross-team TL assigns consultant: routing TL must still pass ``can_view_letter`` for GET /letters/{id}.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker, selectinload
from sqlalchemy.pool import StaticPool

from app.core.letter_access import can_view_letter
from app.core.security import get_password_hash
from app.db.base import Base
from app.models.department import Department  # noqa: F401
from app.models.letter import (
    AssignmentWorkStatus,
    Letter,
    LetterAssignment,
    LetterPriority,
    LetterStatus,
)
from app.models.role import Role
from app.models.user import User, UserStatus  # noqa: F401
from app.rbac.roles import ALL_ROLES, Roles, SYSTEM_ROLE_CODE_BY_DISPLAY_NAME
from app.services.letter_service import LetterService


@pytest.fixture
def db() -> Session:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    s = SessionLocal()
    try:
        roles: dict[str, Role] = {}
        for name in ALL_ROLES:
            r = Role(
                name=name,
                code=SYSTEM_ROLE_CODE_BY_DISPLAY_NAME[name],
                is_system_role=True,
                is_active=True,
                created_at=datetime.now(timezone.utc),
            )
            s.add(r)
            s.flush()
            roles[name] = r

        dept_a = Department(name="Technical", code="TECH")
        dept_b = Department(name="Functional", code="FUNC")
        s.add_all([dept_a, dept_b])
        s.flush()

        def user(email: str, dept_id: int, role_names: tuple[str, ...]) -> User:
            u = User(
                email=email,
                username=email.split("@")[0],
                nid=f"NID-{email}",
                phone_number="+10000000000",
                full_name=email.split("@")[0],
                password_hash=get_password_hash("TestPass123!"),
                status=UserStatus.ACTIVE,
                department_id=dept_id,
            )
            for rn in role_names:
                u.roles.append(roles[rn])
            s.add(u)
            s.flush()
            return u

        tl_a = user("tl_a@x.test", dept_a.id, (Roles.TEAM_LEADER,))
        tl_f = user("tl_f@x.test", dept_b.id, (Roles.TEAM_LEADER,))
        consultant = user("cons@x.test", dept_b.id, (Roles.CONSULTANT,))

        letter = Letter(
            serial_no="LTR-TEST-0001",
            subject="Cross-team",
            received_from="Gov",
            pdf_path="/tmp/x.pdf",
            priority=LetterPriority.NORMAL,
            status=LetterStatus.UNDER_REVIEW,
            department_id=dept_a.id,
            created_by=tl_a.id,
        )
        s.add(letter)
        s.flush()

        dl = datetime.now(timezone.utc) + timedelta(days=3)
        old = LetterAssignment(
            letter_id=letter.id,
            consultant_id=tl_f.id,
            assigned_by=tl_a.id,
            deadline_at=dl,
            is_active=False,
            work_status=AssignmentWorkStatus.TRANSFERRED,
        )
        new = LetterAssignment(
            letter_id=letter.id,
            consultant_id=consultant.id,
            assigned_by=tl_f.id,
            deadline_at=dl,
            is_active=True,
            work_status=AssignmentWorkStatus.ASSIGNED,
        )
        s.add_all([old, new])
        s.commit()

        yield s
    finally:
        s.close()


def test_routing_tl_can_view_letter_after_reassign_to_consultant(db: Session):
    tl_f = db.scalar(select(User).where(User.email == "tl_f@x.test").options(selectinload(User.roles)))
    letter = db.scalar(select(Letter).where(Letter.serial_no == "LTR-TEST-0001"))
    assert tl_f is not None and letter is not None
    assert can_view_letter(db, tl_f, letter) is True

    svc = LetterService(db)
    loaded = svc.get_letter_for_user(letter.id, tl_f)
    assert loaded.id == letter.id


def test_unrelated_user_cannot_view_same_letter(db: Session):
    tl_a = db.scalar(select(User).where(User.email == "tl_a@x.test").options(selectinload(User.roles)))
    letter = db.scalar(select(Letter).where(Letter.serial_no == "LTR-TEST-0001"))
    assert tl_a is not None and letter is not None
    # TL A still has department match on letter.department_id
    assert can_view_letter(db, tl_a, letter) is True

    outsider = User(
        email="out@x.test",
        username="out",
        nid="NID-out",
        phone_number="+10000000001",
        full_name="Out",
        password_hash=get_password_hash("TestPass123!"),
        status=UserStatus.ACTIVE,
        department_id=None,
    )
    db.add(outsider)
    db.flush()
    assert can_view_letter(db, outsider, letter) is False
