from sqlalchemy import select

from db import SessionLocal
from models import Item

SEED_NAMES = ["item-1", "item-2", "item-3"]


def seed() -> None:
    with SessionLocal() as session:
        existing = set(session.scalars(select(Item.name)))
        for name in SEED_NAMES:
            if name not in existing:
                session.add(Item(name=name))
        session.commit()


if __name__ == "__main__":
    seed()
