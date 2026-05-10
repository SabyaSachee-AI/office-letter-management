"""Assignment queue includes department-routed letters before LetterAssignment exists."""

from __future__ import annotations

import io
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import get_password_hash
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.activity import AuditLog, LoginLog, Notification  # noqa: F401
from app.models.department import Department  # noqa: F401
from app.models.letter import Letter, LetterAction, LetterAssignment  # noqa: F401
from app.models.role import Role  # noqa: F401
from app.models.user import User, UserStatus  # noqa: F401
from app.rbac.roles import ALL_ROLES, Roles, SYSTEM_ROLE_CODE_BY_DISPLAY_NAME

PWD = "TestPass123!"
MINIMAL_PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"


def _seed(session) -> dict:
    roles: dict[str, Role] = {}
    for name in ALL_ROLES:
        r = Role(
            name=name,
            code=SYSTEM_ROLE_CODE_BY_DISPLAY_NAME[name],
            is_system_role=True,
            is_active=True,
            created_at=datetime.now(timezone.utc),
        )
        session.add(r)
        session.flush()
        roles[name] = r

    dept = Department(name="Technical", code="TECH")
    session.add(dept)
    session.flush()

    def add_user(
        email: str,
        full_name: str,
        role_names: tuple[str, ...],
        *,
        team_department_id: int | None = None,
    ) -> User:
        u = User(
            email=email,
            username=email.split("@")[0].replace(".", "_"),
            nid=f"NID-{email}",
            phone_number="+10000000000",
            full_name=full_name,
            password_hash=get_password_hash(PWD),
            status=UserStatus.ACTIVE,
            department_id=dept.id,
            team_department_id=team_department_id,
        )
        for rn in role_names:
            u.roles.append(roles[rn])
        session.add(u)
        session.flush()
        return u

    add_user("admin@aq.example.org", "Admin", (Roles.ADMIN,))
    add_user("approval@aq.example.org", "PEC", (Roles.APPROVAL_HEAD,))
    add_user(
        "tl@aq.example.org",
        "Team Lead",
        (Roles.TEAM_LEADER,),
        team_department_id=dept.id,
    )
    add_user("ro@aq.example.org", "RO", (Roles.RECEIVING_OFFICER,))
    session.commit()

    out = {"dept_id": dept.id}
    for key, em in (
        ("admin", "admin@aq.example.org"),
        ("approval", "approval@aq.example.org"),
        ("tl", "tl@aq.example.org"),
        ("ro", "ro@aq.example.org"),
    ):
        u = session.scalar(select(User).where(User.email == em))
        assert u is not None
        out[key] = u.id
    return out


@pytest.fixture
def client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    try:
        seeded = _seed(db)
    finally:
        db.close()

    def override_get_db():
        s = SessionLocal()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as c:
        yield c, seeded

    app.dependency_overrides.clear()


def _login(c: TestClient, email: str, password: str = PWD) -> str:
    r = c.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_assignment_queue_shows_letter_after_pec_department_only(client):
    c, seeded = client
    ro_tok = _login(c, "ro@aq.example.org")
    appr_tok = _login(c, "approval@aq.example.org")
    tl_tok = _login(c, "tl@aq.example.org")

    r_letter = c.post(
        "/api/v1/letters",
        headers=_headers(ro_tok),
        data={"subject": "Queue routing test", "received_from": "Party"},
        files={"file": ("letter.pdf", io.BytesIO(MINIMAL_PDF), "application/pdf")},
    )
    assert r_letter.status_code == 201, r_letter.text
    letter_id = r_letter.json()["id"]

    r_appr = c.post(
        f"/api/v1/workflow/letters/{letter_id}/approve",
        headers=_headers(appr_tok),
        json={
            "comment": "To technical department",
            "target_department_id": seeded["dept_id"],
            "priority": "normal",
        },
    )
    assert r_appr.status_code == 200, r_appr.text
    assert r_appr.json()["department"]["id"] == seeded["dept_id"]

    r_q = c.get(
        "/api/v1/assignments/queue",
        headers=_headers(tl_tok),
        params={"limit": 50, "offset": 0},
    )
    assert r_q.status_code == 200, r_q.text
    ids = [row["id"] for row in r_q.json()["items"]]
    assert letter_id in ids

    r_tr = c.get(
        f"/api/v1/assignments/letters/{letter_id}/tracking",
        headers=_headers(tl_tok),
    )
    assert r_tr.status_code == 200, r_tr.text
    assert not any(a["is_active"] for a in r_tr.json()["assignments"])
