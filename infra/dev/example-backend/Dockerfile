FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN useradd --create-home --shell /bin/bash appuser
COPY --chown=appuser:appuser . .

USER appuser

CMD ["sh", "-c", "alembic upgrade head && python seed.py && uvicorn main:app --host 0.0.0.0 --port 8000"]
