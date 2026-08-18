import os

from fastapi import FastAPI

from app.routers import auth , companies , interviews
from app.seed import seed_user


# 開発用のテストユーザー投入
if os.getenv("SEED_DEV_USER", "").lower() == "true":
    seed_user()

app = FastAPI(title="hanasu API")

app.include_router(auth.router)
app.include_router(companies.router)
app.include_router(interviews.router)

@app.get("/")
def root():
    return {"message": "hello hanasu"}
