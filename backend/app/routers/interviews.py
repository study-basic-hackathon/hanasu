from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.routers import auth
from app.schemas.interview import ChatRequest, ChatResponse, TtsRequest
from app.services import llm, tts

router = APIRouter()


_INTENSITY_GUIDE = {
    "楽々": "優しい口調で、基本的な質問を中心にしてください",
    "標準": "一般的な面接と同じ調子で質問してください",
    "厳しめ": "回答の曖昧な点や矛盾を深掘りし、鋭く追及してください",
}


def _build_system_prompt(company: models.Company, intensity: str, max_turns: int | None, current_turn: int) -> str:
    parts = [
        "あなたは採用面接の面接官です。以下の応募情報を踏まえ、応募者への次の質問を1つだけ、日本語で簡潔に返してください。",
        "質問文のみを返し、前置きや解説は書かないでください。",
        f"# 応募先企業: {company.company_name}",
        f"# 応募者の志望動機: {company.motivation or '（未登録）'}",
        f"# 応募者の経歴: {company.resume or '（未登録）'}",
        f"# 企業URL: {company.company_url or '（未登録）'}",
        f"# 備考: {company.note or '（未登録）'}",
        f"# 質問の強度: {intensity}。{_INTENSITY_GUIDE[intensity]}",
        "会話履歴が空の場合は、自己紹介と志望動機を尋ねる最初の質問をしてください。",
    ]
    if max_turns is not None:
        # current_turn <= max_turns はスキーマ側で保証済み
        remaining = max_turns - current_turn + 1
        parts.append(f"面接はあと最大{remaining}問で終わりです（上限{max_turns}ターン中、今は{current_turn}ターン目）。残りが少ないほど、面接を締めくくる質問に向かってください。")
    return "\n".join(parts)


@router.post("/interviews/chat", response_model=ChatResponse, summary="次の質問を生成する")
def chat(
    chat_in: ChatRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[models.User, Depends(auth.get_current_user)],
):
    """企業情報＋会話履歴から、面接官の次の質問を生成して返す。

    サーバーは会話状態を持たない（履歴はクライアントが毎回全部送る）。ここでは何も保存しない。
    """
    company = db.get(models.Company, chat_in.company_id)
    if company is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="企業情報が見つかりません")

    # 1ターン = 質問1つ + 回答1つ。履歴から「いま何ターン目の質問を作るか」を数える
    current_turn = len(chat_in.history) // 2 + 1
    system = _build_system_prompt(company, chat_in.intensity, chat_in.max_turns, current_turn)
    history = [t.model_dump() for t in chat_in.history]
    try:
        text = llm.generate_reply(system, history)
    except (RuntimeError, NotImplementedError) as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))

    return ChatResponse(text=text)


@router.post("/interviews/tts", summary="面接官の発言を音声化する")
def synthesize_speech(
    tts_in: TtsRequest,
    current_user: Annotated[models.User, Depends(auth.get_current_user)],
):
    """発言テキストを mp3（audio/mpeg）にして返す。何も保存しない。"""
    try:
        audio = tts.synthesize(tts_in.text)
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))

    return Response(content=audio, media_type="audio/mpeg")
