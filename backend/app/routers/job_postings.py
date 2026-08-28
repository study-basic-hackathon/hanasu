from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app import models
from app.routers import auth
from app.schemas.job_posting import JobPostingSummaryRequest, JobPostingSummaryResponse
from app.services import job_posting, llm


router = APIRouter()

INVALID_URL_DETAIL = {
    "code": "invalid_url",
    "message": "有効なHTTP(S) URLを指定してください。",
}
_ERRORS = {
    "url_not_allowed": (
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "指定されたURLにはアクセスできません。",
    ),
    "fetch_failed": (
        status.HTTP_502_BAD_GATEWAY,
        "募集要項を取得できませんでした。",
    ),
    "unsupported_content": (
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "このページは募集要項の要約に対応していません。",
    ),
    "extraction_failed": (
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "募集要項の本文を抽出できませんでした。",
    ),
    "summary_failed": (
        status.HTTP_503_SERVICE_UNAVAILABLE,
        "募集要項の要約を生成できませんでした。",
    ),
}


def _http_error(code: str) -> HTTPException:
    status_code, message = _ERRORS[code]
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message},
    )


@router.post(
    "/job-postings/summary",
    response_model=JobPostingSummaryResponse,
    summary="募集要項URLから要約を生成する",
)
def summarize_job_posting(
    summary_in: JobPostingSummaryRequest,
    current_user: Annotated[models.User, Depends(auth.get_current_user)],
) -> JobPostingSummaryResponse:
    del current_user
    try:
        source_text = job_posting.fetch_and_extract(summary_in.company_url)
    except job_posting.InvalidUrlError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=INVALID_URL_DETAIL,
        ) from None
    except job_posting.UrlNotAllowedError:
        raise _http_error("url_not_allowed") from None
    except job_posting.FetchFailedError:
        raise _http_error("fetch_failed") from None
    except job_posting.UnsupportedContentError:
        raise _http_error("unsupported_content") from None
    except job_posting.ExtractionFailedError:
        raise _http_error("extraction_failed") from None

    try:
        summary = llm.summarize_job_posting(source_text)
    except Exception:
        # Bedrock SDK errors can contain request metadata. The public response
        # is intentionally fixed and the submitted content is not logged here.
        raise _http_error("summary_failed") from None
    if not isinstance(summary, str) or not summary.strip():
        raise _http_error("summary_failed")
    return JobPostingSummaryResponse(summary=summary.strip())
