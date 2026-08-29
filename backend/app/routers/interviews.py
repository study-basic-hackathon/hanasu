from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.routers import auth
from app.schemas.interview import (
    ChatRequest,
    ChatResponse,
    QuestionStrength,
    SttResponse,
    TtsRequest,
)
from app.services import llm, stt, tts

router = APIRouter()

# ECSタスクのメモリ(512MiB)を使い切らないための上限。数分の発話でも十分に収まる値
_MAX_AUDIO_BYTES = 20 * 1024 * 1024


def _read_audio_or_413(audio: UploadFile) -> bytes:
    """音声を上限付きでチャンク読み込みする。超過時は413（読み込み途中で打ち切るため全量はメモリに載らない）。"""
    chunks = bytearray()
    while True:
        chunk = audio.file.read(1024 * 1024)
        if not chunk:
            break
        chunks += chunk
        if len(chunks) > _MAX_AUDIO_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"音声ファイルが大きすぎます（上限{_MAX_AUDIO_BYTES // (1024 * 1024)}MiB）",
            )
    return bytes(chunks)


_QUESTION_STRENGTH_GUIDE = {
    "easy": "優しい口調で、基本的な質問を中心にしてください",
    "standard": "一般的な面接と同じ調子で質問してください",
    "hard": "回答の曖昧な点や矛盾を深掘りし、鋭く追及してください",
}


def _build_system_prompt(
    company: models.Company,
    question_strength: QuestionStrength,
    custom_question_strength: str | None,
    max_turns: int | None,
    current_turn: int,
) -> str:
    if question_strength == "custom":
        # ChatRequest の条件付きバリデーションで必須であることを保証している。
        assert custom_question_strength is not None
        strength_guide = custom_question_strength
    else:
        strength_guide = _QUESTION_STRENGTH_GUIDE[question_strength]

    parts = [
        "あなたは採用面接の面接官です。以下の応募情報を踏まえ、応募者への次の質問を1つだけ、日本語で簡潔に返してください。",
        "質問文のみを返し、前置きや解説は書かないでください。",
        f"# 応募先企業: {company.company_name}",
        f"# 応募者の志望動機: {company.motivation or '（未登録）'}",
        f"# 応募者の経歴: {company.resume or '（未登録）'}",
        f"# 企業URL: {company.company_url or '（未登録）'}",
        f"# 備考: {company.note or '（未登録）'}",
        *([f"# 募集要項の要約: {company.job_summary}"] if company.job_summary else []),
        f"# 質問の強度: {question_strength}。{strength_guide}",
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
    system = _build_system_prompt(
        company,
        chat_in.question_strength,
        chat_in.custom_question_strength,
        chat_in.max_turns,
        current_turn,
    )
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
    audio_bytes = _read_audio_or_413(audio)
    try:
        result = stt.transcribe(audio_bytes, audio.filename or "audio.webm")
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))

    return SttResponse(**result)


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
