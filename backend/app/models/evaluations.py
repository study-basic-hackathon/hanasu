from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    func,
)

from app.database import Base

class Evaluation(Base):
    __tablename__ = "evaluations"

    # PK はこれ単体（GET /evaluations/{evaluation_id} で引くため。API仕様.md 9章）
    evaluation_id = Column(Integer, primary_key=True)
    # 対象企業。チュートリアルの評価は持たない（NULL可）。
    # 企業が削除されても評価履歴は残す（SET NULL。名前は company_name の写しで出す）
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="SET NULL"), nullable=True, index=True)
    # 登録時の企業名の写し（企業削除後も履歴に名前を出すため。screen_api_map 6章）
    company_name = Column(String, nullable=True)
    # processing / completed / failed
    status = Column(String, nullable=False)
    # 以下は completed になるまで NULL
    total_score = Column(Integer, nullable=True)
    scores = Column(JSON, nullable=True)
    advice = Column(JSON, nullable=True)
    # failed のときのエラーメッセージ
    error = Column(String, nullable=True)
    # 練習の実施日時として画面に出す
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
