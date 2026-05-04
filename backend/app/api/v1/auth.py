from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.http_utils import client_ip, client_user_agent
from app.core.security import create_access_token, verify_password
from app.db.session import get_db
from app.models.user import User
from app.models.user import UserStatus
from app.schemas.auth import Token
from app.services.activity_service import ActivityService

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
    email = (form_data.username or "").strip()
    if len(email) > 255:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid credentials",
        )
    if len(form_data.password or "") > 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid credentials",
        )

    user = db.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(form_data.password, user.password_hash):
        acts.record_login(
            email_attempted=email or form_data.username,
            user_id=None,
            success=False,
            ip_address=ip,
            user_agent=ua,
            failure_reason="invalid_credentials",
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if user.status != UserStatus.ACTIVE:
        acts.record_login(
            email_attempted=email,
            user_id=user.id,
            success=False,
            ip_address=ip,
            user_agent=ua,
            failure_reason="inactive_user",
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")

    acts.record_login(
        email_attempted=email,
        user_id=user.id,
        success=True,
        ip_address=ip,
        user_agent=ua,
        failure_reason=None,
    )
    db.commit()

    access_token = create_access_token(
        subject=str(user.id),
        expires_delta=timedelta(minutes=settings.jwt_access_token_expire_minutes),
    )
    return Token(access_token=access_token)
