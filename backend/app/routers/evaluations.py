from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import StaleDataError

from app import models
from app.database import SessionLocal, get_db
from app.routers import auth
from app.schemas.evaluation import EvaluationCreate, EvaluationCreated, EvaluationList
from app.services import llm

router = APIRouter()

# 構成・内容60% / フィラー20% / 話す速さ20%（3:1:1）。整数比で持ち、四捨五入を整数演算で行う
_TOTAL_SCORE_WEIGHTS: dict[str, int] = {
    "structure_content": 3,
    "filler": 1,
    "speaking_speed": 1,
}


def _calculate_total_score(scores: dict) -> int | None:
    """存在する基本項目だけの加重平均を四捨五入する（0.5は切り上げ、欠測項目の重みで正規化）。"""
    weighted_sum = 0
    weight_total = 0
    for key, weight in _TOTAL_SCORE_WEIGHTS.items():
        value = scores.get(key)
        if isinstance(value, dict) and isinstance(value.get("score"), int):
            weighted_sum += value["score"] * weight
            weight_total += weight
    if weight_total == 0:
        return None
    return (weighted_sum * 2 + weight_total) // (weight_total * 2)


def _run_evaluation(evaluation_id: int, company_name: str | None, turns: list[dict]) -> None:
    """バックグラウンドで定性評価（LLM）を実行し、completed / failed にする。

    turns はここ（メモリ）でだけ使い、DB には保存しない。
    レスポンス返却後に走るため、DB セッションはリクエストのものと別に自前で開く。
    """
    db = SessionLocal()
    try:
        ev = db.get(models.Evaluation, evaluation_id)
        if ev is None:
            return
        try:
            qualitative = llm.evaluate_interview(company_name, turns)
            scores = dict(ev.scores or {})
            scores["structure_content"] = {
                "score": qualitative.get("score"),
                "comment": qualitative.get("comment"),
            }
            ev.scores = scores  # JSON カラムは再代入で変更を検知させる
            ev.advice = qualitative.get("advice") or []
            ev.total_score = _calculate_total_score(scores)
            ev.status = "completed"
        except Exception as e:
            ev.error = str(e)
            ev.status = "failed"
        try:
            db.commit()
        except StaleDataError:
            # 評価中に DELETE /evaluations/{id} で消された。書き戻す先がないので何もしない
            db.rollback()
    finally:
        db.close()


@router.post("/evaluations", response_model=EvaluationCreated, status_code=202, summary="評価を実行する（非同期）")
def create_evaluation(
    eval_in: EvaluationCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[models.User, Depends(auth.get_current_user)],
    background_tasks: BackgroundTasks,
):
    """定量スコアを保存して evaluation_id を即返す（202）。定性評価は裏で実行し、
    クライアントは GET /evaluations/{id} を completed / failed までポーリングする。
    """
    company_name = None
    if eval_in.company_id is not None:
        company = db.get(models.Company, eval_in.company_id)
        if company is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="企業情報が見つかりません")
        company_name = company.company_name

    evaluation = models.Evaluation(
        company_id=eval_in.company_id,
        company_name=company_name,
        question_strength=eval_in.question_strength,
        turn_count=eval_in.turn_count,
        status="processing",
        scores=eval_in.scores,
    )
    db.add(evaluation)
    db.commit()
    db.refresh(evaluation)

    background_tasks.add_task(
        _run_evaluation, evaluation.evaluation_id, company_name, [t.model_dump() for t in eval_in.turns]
    )
    return EvaluationCreated(evaluation_id=evaluation.evaluation_id)


@router.get("/evaluations", response_model=EvaluationList, summary="評価履歴を一覧する")
def list_evaluations(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[models.User, Depends(auth.get_current_user)],
):
    """評価履歴を新しい順に全件返す。企業では絞り込まない（チュートリアルの結果も含む）。"""
    rows = (
        db.query(models.Evaluation)
        .order_by(models.Evaluation.created_at.desc(), models.Evaluation.evaluation_id.desc())
        .all()
    )
    return {"evaluations": rows}


@router.get("/evaluations/{evaluation_id}", summary="評価結果を取得する")
def get_evaluation(
    evaluation_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[models.User, Depends(auth.get_current_user)],
):
    """評価結果を返す。status によって形が変わる（API仕様.md 5.6）。

    completed になるまでクライアントがポーリングする想定。
    """
    ev = db.get(models.Evaluation, evaluation_id)
    if ev is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="評価結果が見つかりません")

    metadata = {
        "company_id": ev.company_id,
        "company_name": ev.company_name,
        "question_strength": ev.question_strength,
        "turn_count": ev.turn_count,
    }
    if ev.status == "processing":
        return {"evaluation_id": ev.evaluation_id, "status": ev.status, **metadata}
    if ev.status == "failed":
        return {
            "evaluation_id": ev.evaluation_id,
            "status": ev.status,
            "error": ev.error,
            **metadata,
        }
    return {
        "evaluation_id": ev.evaluation_id,
        **metadata,
        "status": ev.status,
        "created_at": ev.created_at,
        "total_score": ev.total_score,
        "scores": ev.scores,
        "advice": ev.advice,
    }


@router.delete("/evaluations/{evaluation_id}", status_code=204, summary="評価結果を削除する")
def delete_evaluation(
    evaluation_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[models.User, Depends(auth.get_current_user)],
):
    """評価結果を1件削除する（API仕様.md 5.8）。

    status は問わない。processing の評価を消した場合、バックグラウンドの評価は
    書き戻す先を失うだけで、行が復活することはない。
    """
    ev = db.get(models.Evaluation, evaluation_id)
    if ev is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="評価結果が見つかりません")
    db.delete(ev)
    db.commit()
