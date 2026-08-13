from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
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
    # 所有者。この企業を登録したユーザー（自分の企業だけを操作できる）
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    # 企業名。ユーザーごとに一意（別ユーザーは同名でも登録できる）
    name = Column(String, nullable=False)
    # 志望動機（文字列で渡す）
    application_reason = Column(Text, nullable=True)
    # 企業URL（任意）
    company_url = Column(String, nullable=True)
    # 備考（任意）
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # 企業名の一意性はユーザー単位（全体ではなく (user_id, name) で重複を弾く）
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_companies_user_name"),
    )

