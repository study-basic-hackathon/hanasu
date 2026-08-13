from datetime import datetime

from pydantic import BaseModel, ConfigDict

class CompanyCreate(BaseModel):
    name: str
    # 志望動機（必須・文字列で渡す）
    motivation: str
    # 募集要項URL（任意）
    job_posting_url: str | None = None
    # 備考（任意）
    note: str | None = None

class CompanyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    motivation: str | None = None
    job_posting_url: str | None = None
    note: str | None = None
    created_at: datetime
