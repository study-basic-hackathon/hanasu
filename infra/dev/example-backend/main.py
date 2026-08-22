from fastapi import FastAPI
from sqlalchemy import select

from db import SessionLocal
from models import Item

app = FastAPI()


@app.get("/")
def health_check():
    return {"status": "ok"}


@app.get("/items")
def list_items():
    with SessionLocal() as session:
        items = session.scalars(select(Item)).all()
        return [{"id": item.id, "name": item.name} for item in items]
