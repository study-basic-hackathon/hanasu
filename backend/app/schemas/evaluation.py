from datetime import datetime

from pydantic import BaseModel, ConfigDict


# ---- GET /evaluations（履歴一覧）の1行 ----
# API仕様.md 5.7 の4項目 + 画面のための追加項目（企業名・項目別スコア。screen_api_map 6章）
class EvaluationListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    evaluation_id: int
    created_at: datetime
    status: str
    total_score: int | None = None
    company_name: str | None = None
    scores: dict | None = None


class EvaluationList(BaseModel):
    evaluations: list[EvaluationListItem]
