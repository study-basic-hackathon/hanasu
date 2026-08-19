from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.routers import auth
from app.schemas.evaluation import EvaluationList

router = APIRouter()


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
