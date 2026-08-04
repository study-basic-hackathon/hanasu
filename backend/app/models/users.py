from sqlalchemy import Column, DateTime, Integer, String, func

from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)  # 主キー(自動採番)
    login_id = Column(String, unique=True, nullable=False)  # 配布するログインID(重複不可)
    password_hash = Column(String, nullable=False)  # bcryptハッシュ(平文は保存しない)
    created_at = Column(DateTime(timezone=True), server_default=func.now())  # 作成日時(自動)
