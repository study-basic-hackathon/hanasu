from sqlalchemy import (
    Column,
    DateTime,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)

from app.database import Base

class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True)
    # 企業名。一意（ユーザーは1つしか用意しないため全体で重複を弾く — API仕様.md 6章）
    company_name = Column(String, nullable=False)
    # 志望動機（文字列で渡す）
    motivation = Column(Text, nullable=True)
    # 経歴（応募者自身の情報。応募情報に1レコードで持つ — API仕様.md 4章）
    resume = Column(Text, nullable=True)
    # 企業URL（任意）
    company_url = Column(String, nullable=True)
    # 備考（任意）
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("company_name", name="uq_companies_company_name"),
    )

