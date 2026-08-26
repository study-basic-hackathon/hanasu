from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.routers import auth
from app.schemas.interview import ChatRequest, ChatResponse, SttResponse
from app.services import llm, stt

router = APIRouter()


def _build_system_prompt(company: models.Company) -> str:
    """応募情報（企業情報・志望動機・経歴）を面接官の system プロンプトに反映する。"""
    parts = [
        "あなたは採用面接の面接官です。以下の応募情報を踏まえ、応募者への次の質問を1つだけ、日本語で簡潔に返してください。",
        "質問文のみを返し、前置きや解説は書かないでください。",
        f"# 応募先企業: {company.company_name}",
        f"# 応募者の志望動機: {company.motivation or '（未登録）'}",
        f"# 応募者の経歴: {company.resume or '（未登録）'}",
        f"# 企業URL: {company.company_url or '（未登録）'}",
        f"# 備考: {company.note or '（未登録）'}",
        "会話履歴が空の場合は、自己紹介と志望動機を尋ねる最初の質問をしてください。",
    ]
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

    system = _build_system_prompt(company)
    history = [t.model_dump() for t in chat_in.history]
    try:
        text = llm.generate_reply(system, history)
    except (RuntimeError, NotImplementedError) as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))

    return ChatResponse(text=text)


@router.post("/interviews/stt", response_model=SttResponse, summary="文字起こし")
def transcribe(
    current_user: Annotated[models.User, Depends(auth.get_current_user)],
    audio: Annotated[UploadFile, File()],
):
    """録音音声を文字起こしし、フィラー数・話速指標まで算出して返す。

    音声はここで処理するだけで保存しない（ADR-0007）。
    """
    audio_bytes = audio.file.read()
    try:
        result = stt.transcribe(audio_bytes, audio.filename or "audio.webm")
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))

    return SttResponse(**result)
