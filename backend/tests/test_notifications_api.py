from __future__ import annotations

import io
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import get_password_hash
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.activity import AuditLog, LoginLog, Notification, NotificationKind  # noqa: F401
from app.models.department import Department  # noqa: F401
from app.models.letter import AssignmentSolutionFile, Letter, LetterAction, LetterAssignment  # noqa: F401
from app.models.role import Role  # noqa: F401
from app.models.user import User, UserStatus  # noqa: F401
from app.rbac.roles import ALL_ROLES, Roles, SYSTEM_ROLE_CODE_BY_DISPLAY_NAME

PWD = "TestPass123!"
MINIMAL_PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"


def _seed_users(session):
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

    dept = Department(name="Notify Department", code="NTF")
    session.add(dept)
    session.flush()

    def add_user(email: str, full_name: str, role_names: tuple[str, ...], **extra) -> User:
        u = User(
            email=email,
            username=email.split("@")[0].replace(".", "_"),
            nid=f"NID-{email}",
            phone_number="+10000000000",
            full_name=full_name,
            password_hash=get_password_hash(PWD),
            status=UserStatus.ACTIVE,
            department_id=dept.id,
            **extra,
        )
        for rn in role_names:
            u.roles.append(roles[rn])
        session.add(u)
        session.flush()
        return u

    admin = add_user("admin@notify.example.org", "Admin", (Roles.ADMIN,))
    approval = add_user(
        "approval@notify.example.org",
        "Approval Head",
        (Roles.APPROVAL_HEAD,),
        approval_department_id=dept.id,
    )
    leader = add_user(
        "leader@notify.example.org",
        "Team Leader",
        (Roles.TEAM_LEADER,),
        team_department_id=dept.id,
    )
    consultant_a = add_user("consult.a@notify.example.org", "Consult A", (Roles.CONSULTANT,))
    consultant_b = add_user("consult.b@notify.example.org", "Consult B", (Roles.CONSULTANT,))
    receiver = add_user(
        "receiver@notify.example.org",
        "Receiving Officer",
        (Roles.RECEIVING_OFFICER,),
        receiving_department_id=dept.id,
    )
    session.commit()
    return {
        "dept_id": dept.id,
        "admin_id": admin.id,
        "approval_id": approval.id,
        "leader_id": leader.id,
        "consultant_a_id": consultant_a.id,
        "consultant_b_id": consultant_b.id,
        "receiver_id": receiver.id,
    }


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


def test_notifications_triggers_and_read_apis():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    s = SessionLocal()
    seeded = _seed_users(s)
    s.close()

    def override_get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as c:
        admin_tok = _login(c, "admin@notify.example.org")
        appr_tok = _login(c, "approval@notify.example.org")
        leader_tok = _login(c, "leader@notify.example.org")
        cons_a_tok = _login(c, "consult.a@notify.example.org")
        cons_b_tok = _login(c, "consult.b@notify.example.org")
        recv_tok = _login(c, "receiver@notify.example.org")

        # New letter -> Approval Head
        r_letter = c.post(
            "/api/v1/letters",
            headers=_headers(recv_tok),
            data={
                "subject": "Notification flow letter",
                "received_from": "External Party",
            },
            files={"file": ("letter.pdf", io.BytesIO(MINIMAL_PDF), "application/pdf")},
        )
        assert r_letter.status_code == 201, r_letter.text
        letter_id = r_letter.json()["id"]

        r_approval_notes = c.get("/api/v1/activity/notifications", headers=_headers(appr_tok))
        assert r_approval_notes.status_code == 200
        assert any("New received letter" in n["title"] for n in r_approval_notes.json()["items"])

        # PEC assigns department -> Team Leader
        r_appr = c.post(
            f"/api/v1/workflow/letters/{letter_id}/approve",
            headers=_headers(appr_tok),
            json={"comment": "Assigning department", "target_department_id": seeded["dept_id"]},
        )
        assert r_appr.status_code == 200, r_appr.text

        r_leader_notes = c.get("/api/v1/activity/notifications", headers=_headers(leader_tok))
        assert r_leader_notes.status_code == 200
        assert any("Department assigned" in n["title"] for n in r_leader_notes.json()["items"])

        # TL assigns letter -> Consultant A
        deadline = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
        r_assign = c.post(
            f"/api/v1/assignments/letters/{letter_id}/assign",
            headers=_headers(leader_tok),
            json={
                "consultant_id": seeded["consultant_a_id"],
                "deadline_at": deadline,
                "comment": "Please work on this",
            },
        )
        assert r_assign.status_code == 201, r_assign.text
        assignment_id = r_assign.json()["id"]

        r_peers = c.get("/api/v1/users/assignable-workflow-users", headers=_headers(cons_a_tok))
        assert r_peers.status_code == 200, r_peers.text

        r_cons_a_notes = c.get("/api/v1/activity/notifications", headers=_headers(cons_a_tok))
        assert any("New assignment" in n["title"] for n in r_cons_a_notes.json()["items"])

        # Consultant transfers -> Consultant B
        r_transfer = c.post(
            f"/api/v1/consultant/assignments/{assignment_id}/transfer",
            headers=_headers(cons_a_tok),
            json={"target_user_id": seeded["consultant_b_id"], "comment": "Handing over"},
        )
        assert r_transfer.status_code == 200, r_transfer.text
        assignment_b_id = r_transfer.json()["id"]

        r_cons_b_notes = c.get("/api/v1/activity/notifications", headers=_headers(cons_b_tok))
        assert any("Assignment transferred" in n["title"] for n in r_cons_b_notes.json()["items"])

        # Consultant resolves -> Team Leader / closure users
        r_resolve = c.patch(
            f"/api/v1/consultant/assignments/{assignment_b_id}/status",
            headers=_headers(cons_b_tok),
            json={"work_status": "resolved", "comment": "Done"},
        )
        assert r_resolve.status_code == 200, r_resolve.text
        r_leader_after_resolve = c.get("/api/v1/activity/notifications", headers=_headers(leader_tok))
        assert any("Consultant resolved" in n["title"] for n in r_leader_after_resolve.json()["items"])

        # Close flow -> receiving officer + related users
        r_review = c.post(
            f"/api/v1/closure/letters/{letter_id}/review-solution",
            headers=_headers(leader_tok),
            json={"review_comment": "Looks good"},
        )
        assert r_review.status_code == 200, r_review.text
        r_close = c.post(
            f"/api/v1/closure/letters/{letter_id}/close",
            headers=_headers(leader_tok),
            json={"final_comment": "Close now"},
        )
        assert r_close.status_code == 200, r_close.text

        r_recv_notes = c.get("/api/v1/activity/notifications", headers=_headers(recv_tok))
        assert any("Letter closed" in n["title"] for n in r_recv_notes.json()["items"])

        # Read APIs + own-only guard
        cons_items = c.get("/api/v1/activity/notifications", headers=_headers(cons_b_tok)).json()["items"]
        unread = next((n for n in cons_items if not n.get("is_read")), None)
        assert unread is not None

        # User can mark own
        r_mark_own = c.patch(
            f"/api/v1/activity/notifications/{unread['id']}/read",
            headers=_headers(cons_b_tok),
        )
        assert r_mark_own.status_code == 200
        assert r_mark_own.json()["is_read"] is True

        # Other user cannot mark someone else's
        r_mark_other = c.patch(
            f"/api/v1/activity/notifications/{unread['id']}/read",
            headers=_headers(admin_tok),
        )
        assert r_mark_other.status_code == 404

        # Mark all read
        r_mark_all = c.patch("/api/v1/activity/notifications/mark-all-read", headers=_headers(leader_tok))
        assert r_mark_all.status_code == 200
        assert "marked_count" in r_mark_all.json()

    app.dependency_overrides.clear()


def test_notification_list_unread_total_counts_beyond_first_page():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    s = SessionLocal()
    seeded = _seed_users(s)
    for i in range(15):
        s.add(
            Notification(
                user_id=seeded["leader_id"],
                kind=NotificationKind.SYSTEM,
                title=f"Unread bulk {i}",
                body="test",
                letter_id=None,
                link_path=None,
                read_at=None,
            )
        )
    s.commit()
    s.close()

    def override_get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as c:
        leader_tok = _login(c, "leader@notify.example.org")
        r = c.get(
            "/api/v1/activity/notifications",
            headers=_headers(leader_tok),
            params={"limit": 5, "offset": 0},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["unread_total"] >= 15
        assert len(body["items"]) <= 5

    app.dependency_overrides.clear()


def test_consultant_transfer_to_team_leader_notification_and_listing():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    s = SessionLocal()
    seeded = _seed_users(s)
    s.close()

    def override_get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as c:
        appr_tok = _login(c, "approval@notify.example.org")
        leader_tok = _login(c, "leader@notify.example.org")
        cons_a_tok = _login(c, "consult.a@notify.example.org")
        recv_tok = _login(c, "receiver@notify.example.org")

        r_letter = c.post(
            "/api/v1/letters",
            headers=_headers(recv_tok),
            data={"subject": "TL transfer letter", "received_from": "X"},
            files={"file": ("letter.pdf", io.BytesIO(MINIMAL_PDF), "application/pdf")},
        )
        assert r_letter.status_code == 201, r_letter.text
        letter_id = r_letter.json()["id"]

        r_appr = c.post(
            f"/api/v1/workflow/letters/{letter_id}/approve",
            headers=_headers(appr_tok),
            json={"comment": "Dept", "target_department_id": seeded["dept_id"]},
        )
        assert r_appr.status_code == 200, r_appr.text

        deadline = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
        r_assign = c.post(
            f"/api/v1/assignments/letters/{letter_id}/assign",
            headers=_headers(leader_tok),
            json={
                "consultant_id": seeded["consultant_a_id"],
                "deadline_at": deadline,
                "comment": "Work",
            },
        )
        assert r_assign.status_code == 201, r_assign.text
        assignment_id = r_assign.json()["id"]

        r_transfer = c.post(
            f"/api/v1/consultant/assignments/{assignment_id}/transfer",
            headers=_headers(cons_a_tok),
            json={
                "target_user_id": seeded["leader_id"],
                "comment": "Escalating to TL for triage",
            },
        )
        assert r_transfer.status_code == 200, r_transfer.text
        assert r_transfer.json()["consultant_id"] == seeded["leader_id"]

        r_notes = c.get("/api/v1/activity/notifications", headers=_headers(leader_tok))
        assert r_notes.status_code == 200
        hit = next(
            (
                n
                for n in r_notes.json()["items"]
                if "Assignment transferred" in n["title"] and n.get("letter_id") == letter_id
            ),
            None,
        )
        assert hit is not None
        assert "/dashboard/assignment/" in (hit.get("link_path") or "")

        r_list = c.get(
            "/api/v1/letters",
            headers=_headers(leader_tok),
            params={"department_id": seeded["dept_id"], "limit": 50, "offset": 0},
        )
        assert r_list.status_code == 200, r_list.text
        ids = [row["id"] for row in r_list.json()["items"]]
        assert letter_id in ids

    app.dependency_overrides.clear()
