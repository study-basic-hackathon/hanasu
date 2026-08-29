from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.interview import QuestionStrength, Turn  # role: assistant|user / content（chatと同じ形・同じ入力制限）


# ---- POST /evaluations（評価の実行・非同期）----
class EvaluationCreate(BaseModel):
    company_id: int | None = None
    question_strength: QuestionStrength | None
    turn_count: int = Field(ge=0, le=25)
    turns: list[Turn] = Field(max_length=50)
    scores: dict

    @model_validator(mode="after")
    def validate_turn_count(self):
        actual_turn_count = sum(turn.role == "user" for turn in self.turns)
        if self.turn_count != actual_turn_count:
            raise ValueError("turn_count は turns 内の回答数と一致する必要があります")
        return self


class EvaluationCreated(BaseModel):
    evaluation_id: int

class EvaluationListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    evaluation_id: int
    created_at: datetime
    status: str
    total_score: int | None = None
    company_name: str | None = None
    question_strength: QuestionStrength | None = None
    turn_count: int | None = None
    scores: dict | None = None


class EvaluationList(BaseModel):
    evaluations: list[EvaluationListItem]
