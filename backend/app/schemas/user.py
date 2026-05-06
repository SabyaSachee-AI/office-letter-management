from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.user import UserStatus
from app.rbac.roles import ALL_ROLES, Roles
from app.schemas.department import DepartmentOut


class RoleOut(BaseModel):
    id: int
    name: str
    sort_order: int = 100

    model_config = ConfigDict(from_attributes=True)


class UserOut(BaseModel):
    id: int
    email: EmailStr
    username: str | None = None
    full_name: str
    employee_id: str | None = None
    nid: str | None = None
    phone_number: str | None = None
    designation: str | None = None
    status: UserStatus
    department: DepartmentOut | None = None
    approval_department: DepartmentOut | None = None
    team_department: DepartmentOut | None = None
    receiving_department: DepartmentOut | None = None
    consultant_type: str | None = None
    reporting_team_leader_id: int | None = None
    roles: list[RoleOut] = Field(default_factory=list)
    allowed_screens: list[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=2, max_length=80)
    full_name: str = Field(min_length=2, max_length=255)
    password: str = Field(min_length=8, max_length=72)
    nid: str = Field(min_length=1, max_length=32)
    phone_number: str = Field(min_length=1, max_length=32)
    employee_id: str | None = Field(default=None, max_length=64)
    designation: str | None = Field(default=None, max_length=120)
    role_ids: list[int] = Field(default_factory=list)
    department_id: int
    status: UserStatus = UserStatus.ACTIVE
    approval_department_id: int | None = None
    team_department_id: int | None = None
    receiving_department_id: int | None = None
    consultant_type: str | None = Field(default=None, max_length=120)
    reporting_team_leader_id: int | None = None


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    username: str | None = Field(default=None, min_length=2, max_length=80)
    full_name: str | None = Field(default=None, min_length=2, max_length=255)
    password: str | None = Field(default=None, min_length=8, max_length=72)
    nid: str | None = Field(default=None, max_length=32)
    phone_number: str | None = Field(default=None, max_length=32)
    employee_id: str | None = Field(default=None, max_length=64)
    designation: str | None = Field(default=None, max_length=120)
    role_ids: list[int] | None = None
    department_id: int | None = None
    status: UserStatus | None = None
    approval_department_id: int | None = None
    team_department_id: int | None = None
    receiving_department_id: int | None = None
    consultant_type: str | None = Field(default=None, max_length=120)
    reporting_team_leader_id: int | None = None


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
        allowed = set(ALL_ROLES) | {"Admin", "Approval Head"}
        if value not in allowed:
            raise ValueError("Unsupported role")
        return value


class ScreenColumnOut(BaseModel):
    key: str
    label: str


class RolePermissionMatrixOut(BaseModel):
    roles: list[RoleOut]
    columns: list[ScreenColumnOut]
    grants: dict[str, list[str]]


class RolePermissionMatrixUpdate(BaseModel):
    """JSON object: role id (string key) -> list of screen_key strings."""

    grants: dict[str, list[str]]
