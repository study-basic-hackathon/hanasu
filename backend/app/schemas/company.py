from datetime import datetime

from pydantic import BaseModel, ConfigDict, HttpUrl

class CompanyCreate(BaseModel):
    name: str
    # 志望動機（必須・文字列で渡す）
    application_reason: str
    # 企業URL（任意・http(s) の正しいURLのみ受け付ける）
    company_url: HttpUrl | None = None
    # 備考（任意）
    note: str | None = None

class CompanyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    name: str
    application_reason: str | None = None
    company_url: str | None = None
    note: str | None = None
    created_at: datetime
