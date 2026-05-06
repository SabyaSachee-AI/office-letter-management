from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RoleScreenPermission(Base):
    __tablename__ = "role_screen_permissions"

    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"), primary_key=True)
    screen_key: Mapped[str] = mapped_column(String(64), primary_key=True)
