from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import get_password_hash
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.activity import AuditLog, LoginLog, Notification  # noqa: F401
from app.models.department import Department  # noqa: F401
from app.models.letter import (  # noqa: F401
    AssignmentSolutionFile,
    Letter,
    LetterAction,
    LetterAssignment,
)
from app.models.notice import Notice  # noqa: F401
from app.models.role import Role  # noqa: F401
from app.models.user import User, UserStatus  # noqa: F401
from app.rbac.roles import ALL_ROLES, Roles, SYSTEM_ROLE_CODE_BY_DISPLAY_NAME

PWD = "TestPass123!"
ADMIN_EMAIL = "admin@notice.example.org"
RECEIVER_EMAIL = "receiver@notice.example.org"


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _login(c: TestClient, email: str) -> str:
    r = c.post(
        "/api/v1/auth/login",
        data={"username": email, "password": PWD},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _seed_users(session) -> None:
    roles: dict[str, Role] = {}
    for name in ALL_ROLES:
        role = Role(
            name=name,
            code=SYSTEM_ROLE_CODE_BY_DISPLAY_NAME[name],
            is_system_role=True,
            is_active=True,
            created_at=datetime.now(timezone.utc),
        )
        session.add(role)
        session.flush()
        roles[name] = role

    dept = Department(name="Notice Department", code="NTE")
    session.add(dept)
    session.flush()

    admin = User(
        email=ADMIN_EMAIL,
        username="notice_admin",
        full_name="Notice Admin",
        nid="NID-NOTICE-ADMIN",
        phone_number="+8801711111111",
        password_hash=get_password_hash(PWD),
        status=UserStatus.ACTIVE,
        department_id=dept.id,
    )
    admin.roles.append(roles[Roles.SYSTEM_ADMIN])
    session.add(admin)

    recv = User(
        email=RECEIVER_EMAIL,
        username="notice_receiver",
        full_name="Notice Receiver",
        nid="NID-NOTICE-RECV",
        phone_number="+8801722222222",
        password_hash=get_password_hash(PWD),
        status=UserStatus.ACTIVE,
        department_id=dept.id,
    )
    recv.roles.append(roles[Roles.RECEIVING_OFFICER])
    session.add(recv)
    session.commit()


def test_notice_rbac_and_expiry_visibility():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    s = SessionLocal()
    try:
        _seed_users(s)
    finally:
        s.close()

    def override_get_db():
        session = SessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as c:
            admin_tok = _login(c, ADMIN_EMAIL)
            recv_tok = _login(c, RECEIVER_EMAIL)

            # Admin can create notice
            r_create = c.post(
                "/api/v1/notices",
                headers=_headers(admin_tok),
                json={
                    "title": "System Notice",
                    "message": "New circular has been published.",
                    "is_active": True,
                    "is_pinned": True,
                },
            )
            assert r_create.status_code == 201, r_create.text
            notice_id = r_create.json()["id"]

            # Non-admin cannot create
            r_forbidden_create = c.post(
                "/api/v1/notices",
                headers=_headers(recv_tok),
                json={"title": "X", "message": "Y", "is_active": True, "is_pinned": False},
            )
            assert r_forbidden_create.status_code == 403, r_forbidden_create.text

            # Both can view active notice
            r_list_user = c.get("/api/v1/notices", headers=_headers(recv_tok))
            assert r_list_user.status_code == 200, r_list_user.text
            assert any(n["id"] == notice_id for n in r_list_user.json()["items"])

            # Admin can update and set expired date; then notice should disappear
            expired_at = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
            r_update = c.put(
                f"/api/v1/notices/{notice_id}",
                headers=_headers(admin_tok),
                json={
                    "title": "System Notice",
                    "message": "Expired notice.",
                    "expires_at": expired_at,
                    "is_active": True,
                    "is_pinned": False,
                },
            )
            assert r_update.status_code == 200, r_update.text

            r_list_after_expiry = c.get("/api/v1/notices", headers=_headers(recv_tok))
            assert r_list_after_expiry.status_code == 200, r_list_after_expiry.text
            assert not any(n["id"] == notice_id for n in r_list_after_expiry.json()["items"])

            # Non-admin cannot delete
            r_forbidden_delete = c.delete(
                f"/api/v1/notices/{notice_id}",
                headers=_headers(recv_tok),
            )
            assert r_forbidden_delete.status_code == 403, r_forbidden_delete.text

            # Admin can delete
            r_delete = c.delete(f"/api/v1/notices/{notice_id}", headers=_headers(admin_tok))
            assert r_delete.status_code == 204, r_delete.text
    finally:
        app.dependency_overrides.clear()
