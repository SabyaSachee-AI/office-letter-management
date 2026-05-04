from pydantic import BaseModel, ConfigDict


class DepartmentOut(BaseModel):
    id: int
    name: str
    code: str

    model_config = ConfigDict(from_attributes=True)
