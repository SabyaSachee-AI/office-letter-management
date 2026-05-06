from pydantic import BaseModel, ConfigDict


class DepartmentOut(BaseModel):
    id: int
    name: str
    code: str
    sort_order: int = 100
    is_legacy: bool = False

    model_config = ConfigDict(from_attributes=True)
