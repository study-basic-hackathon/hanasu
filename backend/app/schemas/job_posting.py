from urllib.parse import urlsplit

from pydantic import BaseModel, Field, field_validator


class JobPostingSummaryRequest(BaseModel):
    company_url: str = Field(min_length=1, max_length=2048)

    @field_validator("company_url")
    @classmethod
    def validate_http_url(cls, value: str) -> str:
        if "\\" in value or any(
            ord(character) <= 0x20 or ord(character) == 0x7F for character in value
        ):
            raise ValueError("company_url must be a valid HTTP(S) URL")
        try:
            parsed = urlsplit(value)
            parsed_port = parsed.port
        except ValueError:
            raise ValueError("company_url must be a valid HTTP(S) URL") from None
        if (
            parsed.scheme.lower() not in {"http", "https"}
            or not parsed.netloc
            or parsed.hostname is None
            or (parsed_port is not None and not 1 <= parsed_port <= 65535)
        ):
            raise ValueError("company_url must be a valid HTTP(S) URL")
        return value


class JobPostingSummaryResponse(BaseModel):
    summary: str = Field(min_length=1)
