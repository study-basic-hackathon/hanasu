import os

from fastapi import FastAPI

from app.routers import auth , companies , evaluations , interviews
from app.seed import seed_evaluations, seed_user


# 開発用のテストユーザー・評価履歴サンプルの投入
if os.getenv("SEED_DEV_USER", "").lower() == "true":
    seed_user()
    seed_evaluations()

app = FastAPI(title="hanasu API")

app.include_router(auth.router)
app.include_router(companies.router)
app.include_router(interviews.router)
app.include_router(evaluations.router)

@app.get("/")
def root():
    return {"message": "hello hanasu"}
