import sys
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from sqlalchemy import select

from app.core.security import get_password_hash
from app.db.session import SessionLocal
from app.models.department import Department
from app.models.letter import Letter  # noqa: F401
from app.models.role import Role
from app.models.user import User
from app.models.user import UserStatus
from app.rbac.roles import Roles

DEFAULT_EMAIL = "admin@example.com"
DEFAULT_PASSWORD = "Admin@123"
DEFAULT_NAME = "System Admin"
DEFAULT_ROLE = Roles.ADMIN


ROLE_SEEDS = [
    Roles.ADMIN,
    Roles.RECEIVING_OFFICER,
    Roles.APPROVAL_HEAD,
    Roles.TEAM_LEADER,
    Roles.CONSULTANT,
]

DEPARTMENT_SEEDS = [
    ("General Administration", "GA"),
    ("Human Resources", "HR"),
    ("Finance", "FIN"),
]


def run() -> None:
    """Seed roles, departments, and the default admin user. Run after `alembic upgrade head` (PostgreSQL)."""
    db = SessionLocal()
    try:
        for name, code in DEPARTMENT_SEEDS:
            existing_department = db.scalar(select(Department).where(Department.code == code))
            if existing_department is None:
                db.add(Department(name=name, code=code))

        for role_name in ROLE_SEEDS:
            existing_role = db.scalar(select(Role).where(Role.name == role_name))
            if existing_role is None:
                db.add(Role(name=role_name))
        db.flush()
        role = db.scalar(select(Role).where(Role.name == DEFAULT_ROLE))
        if role is None:
            raise RuntimeError(f"Role not found after seed: {DEFAULT_ROLE}")

        user = db.scalar(select(User).where(User.email == DEFAULT_EMAIL))
        if user is None:
            user = User(
                email=DEFAULT_EMAIL,
                full_name=DEFAULT_NAME,
                password_hash=get_password_hash(DEFAULT_PASSWORD),
                status=UserStatus.ACTIVE,
            )
            user.roles.append(role)
            db.add(user)
            db.commit()
            print(f"Seeded user: {DEFAULT_EMAIL} / {DEFAULT_PASSWORD}")
            return

        print(f"User already exists: {DEFAULT_EMAIL}")
    finally:
        db.close()


if __name__ == "__main__":
    run()
