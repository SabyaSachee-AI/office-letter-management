from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.user import UserStatus
from app.rbac.roles import Roles
from app.schemas.department import DepartmentOut


class RoleOut(BaseModel):
    id: int
    name: str

    model_config = ConfigDict(from_attributes=True)


class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    status: UserStatus
    department: DepartmentOut | None = None
    roles: list[RoleOut] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=255)
    password: str = Field(min_length=8, max_length=72)
    role_ids: list[int] = Field(default_factory=list)
    department_id: int | None = None
    status: UserStatus = UserStatus.ACTIVE


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=255)
    password: str | None = Field(default=None, min_length=8, max_length=72)
    role_ids: list[int] | None = None
    department_id: int | None = None
    status: UserStatus | None = None


class UserListResponse(BaseModel):
    items: list[UserOut]
    total: int
    limit: int
    offset: int


class UserFilterParams(BaseModel):
    q: str | None = None
    role_id: int | None = None
    department_id: int | None = None
    status: UserStatus | None = None
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class RoleAssignment(BaseModel):
    role_ids: list[int] = Field(default_factory=list)


class DepartmentAssignment(BaseModel):
    department_id: int | None = None


class StatusUpdate(BaseModel):
    status: UserStatus


class RoleSeedIn(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        allowed = {
            Roles.ADMIN,
            Roles.RECEIVING_OFFICER,
            Roles.APPROVAL_HEAD,
            Roles.TEAM_LEADER,
            Roles.CONSULTANT,
        }
        if value not in allowed:
            raise ValueError("Unsupported role")
        return value
