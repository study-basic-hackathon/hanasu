from datetime import datetime

from pydantic import BaseModel, ConfigDict

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
