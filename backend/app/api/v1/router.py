from fastapi import APIRouter

from app.api.v1.activity import router as activity_router
from app.api.v1.reports import router as reports_router
from app.api.v1.reference import router as reference_router
from app.api.v1.role_permissions import router as role_permissions_router
from app.api.v1.assignments import router as assignments_router
from app.api.v1.auth import router as auth_router
from app.api.v1.closure import router as closure_router
from app.api.v1.consultant import router as consultant_router
from app.api.v1.letters import router as letters_router
from app.api.v1.notices import router as notices_router
from app.api.v1.users import router as users_router
from app.api.v1.workflow import router as workflow_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(role_permissions_router)
api_router.include_router(reference_router)
api_router.include_router(letters_router)
api_router.include_router(workflow_router)
api_router.include_router(assignments_router)
api_router.include_router(consultant_router)
api_router.include_router(closure_router)
api_router.include_router(activity_router)
api_router.include_router(reports_router)
api_router.include_router(notices_router)
