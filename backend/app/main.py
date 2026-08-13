import os

from fastapi import FastAPI

from app import models
from app.database import Base, engine
from app.routers import auth
from app.seed import seed_user

Base.metadata.create_all(bind=engine)

# 開発用のテストユーザー投入
if os.getenv("SEED_DEV_USER", "").lower() == "true":
    seed_user()

app = FastAPI(title="hanasu API")

app.include_router(auth.router)

@app.get("/")
def root():
    return {"message": "hello hanasu"}
