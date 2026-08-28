import os

from fastapi import FastAPI, Request
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_cors_allowed_origins
from app.routers import auth, companies, evaluations, interviews, job_postings
from app.seed import seed_evaluations, seed_user

# 開発用のテストユーザー・評価履歴サンプルの投入
if os.getenv("SEED_DEV_USER", "").lower() == "true":
    seed_user()
    seed_evaluations()


def root():
    return {"message": "hello hanasu"}


def health():
    return {"status": "ok"}


def create_app(allowed_origins: list[str] | None = None) -> FastAPI:
    api = FastAPI(title="hanasu API")

    @api.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ):
        if request.method == "POST" and request.url.path == "/job-postings/summary":
            return JSONResponse(
                status_code=422,
                content={"detail": job_postings.INVALID_URL_DETAIL},
            )
        return await request_validation_exception_handler(request, exc)

    api.add_middleware(
        CORSMiddleware,
        allow_origins=(
            allowed_origins
            if allowed_origins is not None
            else get_cors_allowed_origins()
        ),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

    api.include_router(auth.router)
    api.include_router(companies.router)
    api.include_router(job_postings.router)
    api.include_router(interviews.router)
    api.include_router(evaluations.router)
    api.add_api_route("/", root, methods=["GET"])
    api.add_api_route("/health", health, methods=["GET"])

    return api


app = create_app()
