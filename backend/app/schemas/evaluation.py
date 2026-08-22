from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.interview import Turn  # role: assistant|user / content（chatと同じ形・同じ入力制限）


# ---- POST /evaluations（評価の実行・非同期）----
class EvaluationCreate(BaseModel):
    company_id: int | None = None
    turns: list[Turn] = Field(max_length=50)   
    scores: dict                             


class EvaluationCreated(BaseModel):
    evaluation_id: int

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
