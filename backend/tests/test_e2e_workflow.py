"""
End-to-end API workflow: auth → users → letter → workflow → assignment → consultant → closure → reports.

Uses SQLite :memory: + dependency override (does not touch developer PostgreSQL).
"""

from __future__ import annotations

import io
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app

# Import models so metadata registers tables for create_all
from app.models.activity import AuditLog, LoginLog, Notification  # noqa: F401
from app.models.department import Department  # noqa: F401
from app.models.letter import Letter  # noqa: F401
from app.models.letter import LetterAction  # noqa: F401
from app.models.letter import LetterAssignment  # noqa: F401
from app.models.letter import AssignmentSolutionFile  # noqa: F401
from app.models.role import Role  # noqa: F401
from app.models.user import User  # noqa: F401
from sqlalchemy import select

from app.core.security import get_password_hash
from app.models.user import UserStatus
from app.rbac.roles import ALL_ROLES, Roles


PWD = "TestPass123!"
ADMIN_EMAIL = "admin@workflow.example.org"
APPROVER_EMAIL = "approval@workflow.example.org"
LEADER_EMAIL = "leader@workflow.example.org"
CONSULT_EMAIL = "consultant@workflow.example.org"
NEW_USER_EMAIL = "new_receiver@workflow.example.org"


def _seed_users(session) -> tuple[int, dict[str, int]]:
    roles: dict[str, Role] = {}
    for name in ALL_ROLES:
        r = Role(name=name)
        session.add(r)
        session.flush()
        roles[name] = r

    dept = Department(name="E2E Department", code="E2E")
    session.add(dept)
    session.flush()
    dept_id = dept.id

    def add_user(email: str, full_name: str, role_names: tuple[str, ...]) -> User:
        u = User(
            email=email,
            full_name=full_name,
            password_hash=get_password_hash(PWD),
            status=UserStatus.ACTIVE,
            department_id=dept_id,
        )
        for rn in role_names:
            u.roles.append(roles[rn])
        session.add(u)
        session.flush()
        return u

    add_user(ADMIN_EMAIL, "Admin User", (Roles.ADMIN,))
    add_user(APPROVER_EMAIL, "Approval Head", (Roles.APPROVAL_HEAD,))
    add_user(LEADER_EMAIL, "Team Leader", (Roles.TEAM_LEADER,))
    add_user(CONSULT_EMAIL, "Consultant User", (Roles.CONSULTANT,))
    session.commit()

    emails = {
        "admin": ADMIN_EMAIL,
        "approval": APPROVER_EMAIL,
        "leader": LEADER_EMAIL,
        "consultant": CONSULT_EMAIL,
    }
    id_by_key: dict[str, int] = {}
    for key, em in emails.items():
        u = session.scalar(select(User).where(User.email == em))
        assert u is not None
        id_by_key[key] = u.id
    return dept_id, id_by_key


@pytest.fixture
def client():
    # StaticPool: in-memory DB visible across threads (TestClient runs routes in a pool).
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    db = SessionLocal()
    try:
        dept_id, _ = _seed_users(db)
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
        yield c, dept_id

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


MINIMAL_PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"


def test_full_workflow_reports_and_exports(client):
    c, dept_id = client

    # 1. Admin login
    admin_tok = _login(c, ADMIN_EMAIL)

    # 2. Create user (Receiving Officer) via API
    r_roles = c.get("/api/v1/reference/roles", headers=_headers(admin_tok))
    assert r_roles.status_code == 200
    role_rows = r_roles.json()
    ro_id = next(r["id"] for r in role_rows if r["name"] == Roles.RECEIVING_OFFICER)

    r_create = c.post(
        "/api/v1/users",
        headers=_headers(admin_tok),
        json={
            "email": NEW_USER_EMAIL,
            "full_name": "New Receiver",
            "password": PWD,
            "role_ids": [ro_id],
            "department_id": dept_id,
            "status": "active",
        },
    )
    assert r_create.status_code == 201, r_create.text

    # 3. New receiving officer creates letter
    recv_tok = _login(c, NEW_USER_EMAIL)
    files = {"file": ("letter.pdf", io.BytesIO(MINIMAL_PDF), "application/pdf")}
    data = {
        "subject": "E2E workflow letter",
        "received_from": "External Party",
        "department_id": str(dept_id),
        "priority": "normal",
    }
    r_letter = c.post(
        "/api/v1/letters",
        headers=_headers(recv_tok),
        data=data,
        files=files,
    )
    assert r_letter.status_code == 201, r_letter.text
    letter_id = r_letter.json()["id"]
    assert r_letter.json()["status"] == "received"

    # 4. Approval Head approves
    appr_tok = _login(c, APPROVER_EMAIL)
    r_appr = c.post(
        f"/api/v1/workflow/letters/{letter_id}/approve",
        headers=_headers(appr_tok),
        json={"comment": "Approved for processing."},
    )
    assert r_appr.status_code == 200, r_appr.text
    assert r_appr.json()["status"] == "processed"

    # 5. Team Leader assigns consultant
    leader_tok = _login(c, LEADER_EMAIL)
    cons_row = c.get("/api/v1/users", headers=_headers(admin_tok), params={"q": CONSULT_EMAIL}).json()
    consultant_id = next(u["id"] for u in cons_row["items"] if u["email"] == CONSULT_EMAIL)

    deadline = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    r_asn = c.post(
        f"/api/v1/assignments/letters/{letter_id}/assign",
        headers=_headers(leader_tok),
        json={
            "consultant_id": consultant_id,
            "deadline_at": deadline,
            "comment": "Please resolve.",
        },
    )
    assert r_asn.status_code == 201, r_asn.text
    assignment_id = r_asn.json()["id"]
    assert r_asn.json()["consultant_id"] == consultant_id

    # 6. Consultant resolves issue (mark assignment resolved)
    cons_tok = _login(c, CONSULT_EMAIL)
    r_res = c.patch(
        f"/api/v1/consultant/assignments/{assignment_id}/status",
        headers=_headers(cons_tok),
        json={
            "work_status": "resolved",
            "comment": "Work completed.",
        },
    )
    assert r_res.status_code == 200, r_res.text

    # 7. Team Leader reviews solution then closes issue
    r_rev = c.post(
        f"/api/v1/closure/letters/{letter_id}/review-solution",
        headers=_headers(leader_tok),
        json={"review_comment": "Solution reviewed and accepted."},
    )
    assert r_rev.status_code == 200, r_rev.text

    r_close = c.post(
        f"/api/v1/closure/letters/{letter_id}/close",
        headers=_headers(leader_tok),
        json={"final_comment": "Closing formally after review."},
    )
    assert r_close.status_code == 200, r_close.text
    assert r_close.json()["status"] == "closed"

    # 8. Reports and exports
    r_an = c.get("/api/v1/reports/analytics", headers=_headers(leader_tok))
    assert r_an.status_code == 200, r_an.text
    body = r_an.json()
    assert "total_letters" in body or "letters_by_status" in body

    r_pdf = c.get("/api/v1/reports/export/letters.pdf", headers=_headers(leader_tok))
    assert r_pdf.status_code == 200
    assert r_pdf.headers.get("content-type", "").startswith("application/pdf")
    assert len(r_pdf.content) > 100

    r_xlsx = c.get("/api/v1/reports/export/letters.xlsx", headers=_headers(leader_tok))
    assert r_xlsx.status_code == 200
    assert "spreadsheet" in r_xlsx.headers.get("content-type", "") or r_xlsx.headers.get(
        "content-type", ""
    ).startswith(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert len(r_xlsx.content) > 50
