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

    evaluation_id = Column(Integer, primary_key=True)
    # 対象企業。チュートリアルの評価は持たない。企業が削除されたら NULL になる（履歴は残す）
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="SET NULL"), nullable=True, index=True)
    # 登録時の企業名の写し。企業の削除・改名後も履歴にその時点の名前を出すために持つ
    company_name = Column(String, nullable=True)
    # 評価の状態（processing / completed / failed）。クライアントは completed までポーリングする
    status = Column(String, nullable=False)
    # 総合スコア（completed になるまで NULL）
    total_score = Column(Integer, nullable=True)
    # 項目別スコア（話速・フィラー・構成内容）。completed になるまで NULL
    scores = Column(JSON, nullable=True)
    # アドバイスの文字列リスト。completed になるまで NULL
    advice = Column(JSON, nullable=True)
    # failed のときのエラーメッセージ
    error = Column(String, nullable=True)
    # 練習の実施日時として画面に出す
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
