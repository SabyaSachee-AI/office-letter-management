import json
import logging
from typing import Any

from sqlalchemy.orm import Session

from app.models.activity import AuditLog
from app.models.user import User

logger = logging.getLogger(__name__)


class AuditLogService:
    def __init__(self, db: Session):
        self.db = db

    def _json_or_none(self, value: Any) -> str | None:
        if value is None:
            return None
        return json.dumps(value, ensure_ascii=False, default=str)

    def _derive_role_name(self, actor: User | None) -> str | None:
        if actor is None:
            return None
        names = sorted({r.name for r in actor.roles if getattr(r, "is_active", True)})
        if not names:
            return None
        return ", ".join(names)

    def log(
        self,
        *,
        actor_user_id: int | None,
        action: str,
        module: str | None = None,
        description: str | None = None,
        entity_type: str | None = None,
        entity_id: int | None = None,
        old_value: Any = None,
        new_value: Any = None,
        detail: dict[str, Any] | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        actor_user_name: str | None = None,
        actor_role_name: str | None = None,
        resource_type: str | None = None,
        resource_id: int | None = None,
    ) -> None:
        actor: User | None = None
        if actor_user_id is not None and (actor_user_name is None or actor_role_name is None):
            actor = self.db.get(User, actor_user_id)
        user_name = actor_user_name or (actor.full_name if actor else None)
        role_name = actor_role_name or self._derive_role_name(actor)
        self.db.add(
            AuditLog(
                actor_user_id=actor_user_id,
                user_name=user_name,
                role=role_name,
                module=module,
                action=action,
                description=description,
                entity_type=entity_type or resource_type,
                entity_id=entity_id if entity_id is not None else resource_id,
                old_value=self._json_or_none(old_value),
                new_value=self._json_or_none(new_value),
                resource_type=resource_type or entity_type,
                resource_id=resource_id if resource_id is not None else entity_id,
                detail_json=self._json_or_none(detail),
                ip_address=ip_address,
                user_agent=user_agent,
            )
        )

    def log_safe(self, **kwargs: Any) -> None:
        try:
            with self.db.begin_nested():
                self.log(**kwargs)
                self.db.flush()
        except Exception:
            logger.exception("Audit log write failed")
