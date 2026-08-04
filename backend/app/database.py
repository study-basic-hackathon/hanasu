import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# 第2引数は保険
DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql+psycopg://hanasu:hanasu@db:5432/hanasu"
)

engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
