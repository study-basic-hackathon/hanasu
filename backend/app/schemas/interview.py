from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator


QuestionStrength = Literal["easy", "standard", "hard", "custom"]
CustomQuestionStrength = Annotated[
    str, StringConstraints(min_length=1, max_length=500)
]


# 会話の1ターン。履歴はクライアントが保持し、毎回全部送ってくる（サーバーは保存しない）
class Turn(BaseModel):
    role: Literal["assistant", "user"]
    content: str = Field(max_length=4000)

# ---- POST /interviews/chat（次の質問を生成）----
class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    company_id: int        # 応募情報（企業情報・志望動機）はサーバーがここから読む
    question_strength: QuestionStrength
    custom_question_strength: CustomQuestionStrength | None = None
    # le=25 は history の上限（50メッセージ = 質問+回答で25ターン分）に合わせた値
    max_turns: int | None = Field(default=None, ge=1, le=25)
    history: list[Turn] = Field(max_length=50)

    @field_validator("custom_question_strength", mode="before")
    @classmethod
    def strip_custom_question_strength(cls, value):
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def validate_conditional_fields_and_history(self):
        if self.question_strength == "custom":
            if self.custom_question_strength is None:
                raise ValueError(
                    "custom のときは custom_question_strength が必要です"
                )
        elif "custom_question_strength" in self.model_fields_set:
            raise ValueError(
                "custom_question_strength は custom のときだけ指定できます"
            )
        if self.history and self.history[-1].role != "user":
            raise ValueError("history は user の発言で終わる必要があります")
        # 上限ターンを超えた履歴は矛盾した入力（フロントは上限で打ち切る約束。ADR-0008）
        if self.max_turns is not None and len(self.history) // 2 + 1 > self.max_turns:
            raise ValueError("history が max_turns の上限を超えています")
        return self


class ChatResponse(BaseModel):
    text: str              # 次のAIの返答（次の質問）


# ---- POST /interviews/stt（文字起こし）----
class SttResponse(BaseModel):
    raw_transcript: str     # フィラー込み（%えー% 形式）。評価に渡すのはこちら
    clean_transcript: str   # フィラー除去済み。画面表示専用
    filler_count: int
    filler_count_per_min: float
    duration_ms: int
    chars: int
    chars_per_min: int


# ---- POST /interviews/tts（音声化）----
class TtsRequest(BaseModel):
    #3000 は Polly の1リクエスト上限
    text: str = Field(min_length=1, max_length=3000)
