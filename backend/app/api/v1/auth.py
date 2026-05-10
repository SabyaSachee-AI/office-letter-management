from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.http_utils import client_ip, client_user_agent
from app.core.security import create_access_token, verify_password
from app.db.session import get_db
from app.models.user import User
from app.models.user import UserStatus
from app.schemas.auth import Token
from app.services.activity_service import ActivityService
from app.services.audit_log_service import AuditLogService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=Token)
def login(
    request: Request,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[Session, Depends(get_db)],
) -> Token:
    ip = client_ip(request)
    ua = client_user_agent(request)
    acts = ActivityService(db)
    audits = AuditLogService(db)
    login_id = (form_data.username or "").strip()
    if len(login_id) > 255:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid credentials",
        )
    if len(form_data.password or "") > 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid credentials",
        )

    user = db.scalar(
        select(User).where(or_(User.email == login_id, User.username == login_id))
    )
    if user is None or not verify_password(form_data.password, user.password_hash):
        audits.log_safe(
            actor_user_id=None,
            actor_user_name=login_id or form_data.username,
            module="auth",
            action="login_failed",
            description="Login failed: invalid credentials",
            entity_type="user",
            ip_address=ip,
            user_agent=ua,
            new_value={"email_attempted": login_id or form_data.username, "reason": "invalid_credentials"},
        )
        acts.record_login(
            email_attempted=login_id or form_data.username,
            user_id=None,
            success=False,
            ip_address=ip,
            user_agent=ua,
            failure_reason="invalid_credentials",
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email, username, or password",
        )
    if user.status != UserStatus.ACTIVE:
        audits.log_safe(
            actor_user_id=user.id,
            actor_user_name=user.full_name,
            module="auth",
            action="login_failed",
            description="Login failed: inactive user",
            entity_type="user",
            entity_id=user.id,
            ip_address=ip,
            user_agent=ua,
            new_value={"email_attempted": user.email, "reason": "inactive_user"},
        )
        acts.record_login(
            email_attempted=user.email,
            user_id=user.id,
            success=False,
            ip_address=ip,
            user_agent=ua,
            failure_reason="inactive_user",
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")

    acts.record_login(
        email_attempted=user.email,
        user_id=user.id,
        success=True,
        ip_address=ip,
        user_agent=ua,
        failure_reason=None,
    )
    audits.log_safe(
        actor_user_id=user.id,
        actor_user_name=user.full_name,
        module="auth",
        action="login_success",
        description="User logged in successfully",
        entity_type="user",
        entity_id=user.id,
        ip_address=ip,
        user_agent=ua,
        new_value={"email": user.email},
    )
    db.commit()

    access_token = create_access_token(
        subject=str(user.id),
        expires_delta=timedelta(minutes=settings.jwt_access_token_expire_minutes),
    )
    return Token(access_token=access_token)
