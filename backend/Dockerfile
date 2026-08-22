FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim

# Python のログを即時出力
ENV PYTHONUNBUFFERED=1
# __pycache__(.pyc) を書かせない（マウント先が汚れるのを防ぐ）
ENV PYTHONDONTWRITEBYTECODE=1

ENV UV_PROJECT_ENVIRONMENT=/opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app


COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev

COPY . .

# 起動時にマイグレーションを適用してからAPIを立ち上げる（本番=ECSでも同じ流れ）
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]