from typing import Literal

from pydantic import BaseModel


# 会話の1ターン。履歴はクライアントが保持し、毎回全部送ってくる（サーバーは保存しない）
class Turn(BaseModel):
    role: Literal["assistant", "user"]
    content: str


# ---- POST /interviews/chat（次の質問を生成）----
class ChatRequest(BaseModel):
    company_id: int        # 応募情報（企業情報・志望動機）はサーバーがここから読む
    history: list[Turn]    # これまでの会話履歴ぜんぶ


class ChatResponse(BaseModel):
    text: str              # 次のAIの返答（次の質問）
