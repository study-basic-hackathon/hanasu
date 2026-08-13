from sqlalchemy import Column, DateTime, Integer, String, Text, func

from app.database import Base

class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    # 志望動機（文字列で渡す）
    motivation = Column(Text, nullable=True)
    # 募集要項URL（任意）
    job_posting_url = Column(String, nullable=True)
    # 備考（任意）
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

