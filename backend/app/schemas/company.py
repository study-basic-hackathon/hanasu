from datetime import datetime

from pydantic import BaseModel, ConfigDict

class CompanyCreate(BaseModel):
    name: str

class CompanyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    created_at: datetime
