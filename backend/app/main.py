from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.error_handlers import register_exception_handlers
from app.api.middleware import AccessLogMiddleware
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.logging_config import configure_logging
from app.db.base import Base
from app.db.session import engine
from app.models.activity import AuditLog, LoginLog, Notification  # noqa: F401
from app.models.department import Department  # noqa: F401
from app.models.letter import Letter  # noqa: F401
from app.models.letter import LetterAction  # noqa: F401
from app.models.letter import LetterAssignment  # noqa: F401
from app.models.letter import AssignmentSolutionFile  # noqa: F401
from app.models.notice import Notice  # noqa: F401
from app.models.role import Role  # noqa: F401
from app.models.role_screen_permission import RoleScreenPermission  # noqa: F401
from app.models.user import User  # noqa: F401


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # PostgreSQL schema is managed by Alembic. SQLite dev uses create_all as a convenience.
    if settings.database_url.startswith("sqlite"):
        Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Office Letter Management API", lifespan=lifespan)

configure_logging(settings)
register_exception_handlers(app)

_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
_cors_kwargs: dict = {
    "allow_origins": _origins or ["http://localhost:3000"],
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}
# Dev only: allow Next.js when opened via LAN IP (e.g. http://192.168.x.x:3000); static list alone blocks those origins.
_env = (settings.app_env or "").lower()
if _env in ("development", "dev", "local"):
    _cors_kwargs["allow_origin_regex"] = (
        r"https?://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})"
        r"(:\d+)?"
    )

app.add_middleware(CORSMiddleware, **_cors_kwargs)
app.add_middleware(AccessLogMiddleware)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(api_router, prefix="/api/v1")
