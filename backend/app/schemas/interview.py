from typing import Literal

from pydantic import BaseModel, Field, model_validator


# 会話の1ターン。履歴はクライアントが保持し、毎回全部送ってくる（サーバーは保存しない）
class Turn(BaseModel):
    role: Literal["assistant", "user"]
    content: str = Field(max_length=4000)

# ---- POST /interviews/chat（次の質問を生成）----
class ChatRequest(BaseModel):
    company_id: int        # 応募情報（企業情報・志望動機）はサーバーがここから読む
    intensity: Literal["楽々", "標準", "厳しめ"] = "標準"
    max_turns: int | None = Field(default=None, ge=1, le=50)
    history: list[Turn] = Field(max_length=50)

    @model_validator(mode="after")
    def history_must_end_with_user(self):
        if self.history and self.history[-1].role != "user":
            raise ValueError("history は user の発言で終わる必要があります")
        return self


class ChatResponse(BaseModel):
    text: str              # 次のAIの返答（次の質問）


class TtsRequest(BaseModel):
    #3000 は Polly の1リクエスト上限
    text: str = Field(min_length=1, max_length=3000)
