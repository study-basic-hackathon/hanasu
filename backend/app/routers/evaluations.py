from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models
from app.database import SessionLocal, get_db
from app.routers import auth
from app.schemas.evaluation import EvaluationCreate, EvaluationCreated, EvaluationList
from app.services import llm

router = APIRouter()


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
            nums = [
                v["score"] for v in scores.values()
                if isinstance(v, dict) and isinstance(v.get("score"), int)
            ]
            ev.scores = scores  # JSON カラムは再代入で変更を検知させる
            ev.advice = qualitative.get("advice") or []
            ev.total_score = round(sum(nums) / len(nums)) if nums else None
            ev.status = "completed"
        except Exception as e:
            ev.error = str(e)
            ev.status = "failed"
        db.commit()
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
        company_name = company.name 

    evaluation = models.Evaluation(
        company_id=eval_in.company_id,
        company_name=company_name,
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

    if ev.status == "processing":
        return {"evaluation_id": ev.evaluation_id, "status": ev.status}
    if ev.status == "failed":
        return {"evaluation_id": ev.evaluation_id, "status": ev.status, "error": ev.error}
    return {
        "evaluation_id": ev.evaluation_id,
        "company_id": ev.company_id,
        "company_name": ev.company_name,
        "status": ev.status,
        "created_at": ev.created_at,
        "total_score": ev.total_score,
        "scores": ev.scores,
        "advice": ev.advice,
    }
