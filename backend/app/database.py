import os
from urllib.parse import quote_plus

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


def _build_database_url() -> str:
    """接続URLを組み立てる。

    ECS上ではDATABASE_URLを直接渡さず、DB_HOST/DB_PORT/DB_NAME(環境変数)と
    DB_USERNAME/DB_PASSWORD(Secrets Managerから注入)から実行時に組み立てる。
    RDSのマスターパスワードをTerraformで接続文字列に加工するとstateに平文で残るため、
    Terraform側はARNだけを扱い、文字列の組み立てはここで行う(パスワードはurlencodeする)。
    """
    explicit_url = os.getenv("DATABASE_URL")
    if explicit_url:
        return explicit_url

    db_host = os.getenv("DB_HOST")
    if not db_host:
        return "postgresql+psycopg://hanasu:hanasu@db:5432/hanasu"

    db_port = os.getenv("DB_PORT", "5432")
    db_name = os.getenv("DB_NAME", "hanasu")
    db_username = quote_plus(os.getenv("DB_USERNAME", ""))
    db_password = quote_plus(os.getenv("DB_PASSWORD", ""))
    return f"postgresql+psycopg://{db_username}:{db_password}@{db_host}:{db_port}/{db_name}"


DATABASE_URL = _build_database_url()

engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
