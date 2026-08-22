import os

DEFAULT_CORS_ALLOWED_ORIGINS = ("http://localhost:3000",)


def get_cors_allowed_origins() -> list[str]:
    """Return the comma-separated CORS origins configured for the API."""
    raw_origins = os.getenv("CORS_ALLOWED_ORIGINS", "")
    origins = list(
        dict.fromkeys(
            origin.strip() for origin in raw_origins.split(",") if origin.strip()
        )
    )

    if not origins:
        return list(DEFAULT_CORS_ALLOWED_ORIGINS)
    if "*" in origins:
        raise RuntimeError("CORS_ALLOWED_ORIGINS に '*' は指定できません")

    return origins
