from sqlalchemy import Column , Integer , String ,DateTime , func

from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Coumn(Integer, primary_key=True)
    user_id = Column(String, unique=True, nullable=False)
    password = Column(String,nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())