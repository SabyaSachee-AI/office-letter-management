import enum

from sqlalchemy import Column, Enum, ForeignKey, String, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.enum_values import member_values

class UserStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"


user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", ForeignKey("users.id"), primary_key=True),
    Column("role_id", ForeignKey("roles.id"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    username: Mapped[str | None] = mapped_column(String(80), unique=True, index=True, nullable=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    employee_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    nid: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    phone_number: Mapped[str | None] = mapped_column(String(32), nullable=True)
    designation: Mapped[str | None] = mapped_column(String(120), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[UserStatus] = mapped_column(
        Enum(UserStatus, name="user_status", values_callable=member_values),
        nullable=False,
        default=UserStatus.ACTIVE,
        index=True,
    )
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"), nullable=True, index=True)
    approval_department_id: Mapped[int | None] = mapped_column(
        ForeignKey("departments.id"), nullable=True, index=True
    )
    team_department_id: Mapped[int | None] = mapped_column(
        ForeignKey("departments.id"), nullable=True, index=True
    )
    receiving_department_id: Mapped[int | None] = mapped_column(
        ForeignKey("departments.id"), nullable=True, index=True
    )
    consultant_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    reporting_team_leader_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )

    roles = relationship("Role", secondary=user_roles, back_populates="users")
    department = relationship("Department", back_populates="users", foreign_keys=[department_id])
    approval_department = relationship(
        "Department", foreign_keys=[approval_department_id], viewonly=True
    )
    team_department = relationship(
        "Department", foreign_keys=[team_department_id], viewonly=True
    )
    receiving_department = relationship(
        "Department", foreign_keys=[receiving_department_id], viewonly=True
    )
