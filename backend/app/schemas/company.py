from datetime import datetime
from typing import Annotated

from pydantic import (
    BaseModel,
    ConfigDict,
    HttpUrl,
    StringConstraints,
    field_validator,
)

CompanyName = Annotated[str, StringConstraints(min_length=1, max_length=100)]
Motivation = Annotated[str, StringConstraints(min_length=1, max_length=4_000)]


class CompanyCreate(BaseModel):
    company_name: CompanyName
    # 志望動機（必須・文字列で渡す）
    motivation: Motivation
    # 経歴（任意・応募者自身の情報）
    resume: str | None = None
    # 企業URL（任意・http(s) の正しいURLのみ受け付ける）
    company_url: HttpUrl | None = None
    # 募集要項の要約（任意）
    job_summary: str | None = None
    # 備考（任意）
    note: str | None = None

    @field_validator("company_name", "motivation", mode="before")
    @classmethod
    def strip_required_fields(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("resume", "job_summary", "note", mode="before")
    @classmethod
    def normalize_optional_text(cls, value, info):
        if not isinstance(value, str):
            return value
        stripped = value.strip()
        if not stripped:
            return None
        max_length = {"resume": 10_000, "note": 2_000}.get(info.field_name)
        if max_length is not None and len(stripped) > max_length:
            raise ValueError(
                f"{info.field_name} must be at most {max_length} characters"
            )
        return value

    @field_validator("company_url", mode="before")
    @classmethod
    def normalize_company_url(cls, value):
        if not isinstance(value, str):
            return value
        stripped = value.strip()
        if not stripped:
            return None
        if len(stripped) > 2_048:
            raise ValueError("company_url must be at most 2048 characters")
        return stripped


class CompanyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    company_name: str
    motivation: str | None = None
    resume: str | None = None
    company_url: str | None = None
    job_summary: str | None = None
    note: str | None = None
    created_at: datetime
