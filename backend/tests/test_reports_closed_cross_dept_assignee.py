"""Closed letters stay in reports/listing when assignee department != letter.department_id."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import get_password_hash
from app.db.base import Base
from app.models.department import Department
from app.models.letter import AssignmentWorkStatus, Letter, LetterAssignment, LetterPriority, LetterStatus
from app.models.user import User, UserStatus
from app.services.letter_service import LetterService
from app.services.report_service import ReportFilters, ReportsService


@pytest.fixture
def db_session() -> Session:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()
        Base.metadata.drop_all(bind=engine)


def test_reports_and_list_include_closed_cross_department_assignee(db_session: Session) -> None:
    d1 = Department(name="Technical", code="TECH")
    d2 = Department(name="Operations", code="OPS")
    db_session.add_all([d1, d2])
    db_session.flush()

    u_creator = User(
        email="c@example.org",
        username="creator",
        nid="NID-C",
        phone_number="+10000000001",
        full_name="Creator",
        password_hash=get_password_hash("TestPass123!"),
        status=UserStatus.ACTIVE,
        department_id=d1.id,
    )
    u_viewer = User(
        email="v@example.org",
        username="viewer",
        nid="NID-V",
        phone_number="+10000000002",
        full_name="Viewer",
        password_hash=get_password_hash("TestPass123!"),
        status=UserStatus.ACTIVE,
        department_id=d2.id,
    )
    db_session.add_all([u_creator, u_viewer])
    db_session.flush()

    now = datetime.now(timezone.utc)
    letter = Letter(
        serial_no="LTR-CROSS-REPORT-001",
        subject="Cross-dept closed",
        received_from="Party",
        pdf_path="/tmp/x.pdf",
        priority=LetterPriority.NORMAL,
        status=LetterStatus.CLOSED,
        department_id=d1.id,
        created_by=u_creator.id,
        created_at=now,
        closed_at=now,
        closed_by=u_creator.id,
    )
    db_session.add(letter)
    db_session.flush()

    db_session.add(
        LetterAssignment(
            letter_id=letter.id,
            consultant_id=u_viewer.id,
            assigned_by=u_creator.id,
            is_active=False,
            work_status=AssignmentWorkStatus.RESOLVED,
        )
    )
    db_session.commit()

    filters = ReportFilters(
        date_from=None,
        date_to=None,
        department_id=None,
        status=None,
        q=None,
        from_office=None,
    )
    analytics = ReportsService(db_session).get_analytics(u_viewer, filters)
    assert analytics["closed_letters"] == 1
    assert analytics["total_letters"] == 1

    items, total = LetterService(db_session).list_letters(
        u_viewer,
        limit=20,
        offset=0,
        department_id=d2.id,
    )
    assert total == 1
    assert items[0].id == letter.id
