from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app import models
from app.database import get_db
from app.routers import auth
from app.schemas.company import CompanyCreate, CompanyOut


router = APIRouter()

# 企業情報、全件取得
@router.get("/companies", response_model=list[CompanyOut])
def get_companies(db: Annotated[Session,Depends(get_db)],current_user: Annotated[models.User,Depends(auth.get_current_user)]):
    companies = db.query(models.Company).all()
    return companies

# 企業情報、一件取得
@router.get("/companies/{company_id}", response_model=CompanyOut)
def get_company(company_id: int, db: Annotated[Session, Depends(get_db)], current_user: Annotated[models.User, Depends(auth.get_current_user)]):
    company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="企業情報が見つかりません",
        )
    return company

# 企業情報保存
@router.post("/companies", response_model=CompanyOut, status_code=201)
def create_company(company_in:CompanyCreate,db: Annotated[Session,Depends(get_db)],current_user: Annotated[models.User,Depends(auth.get_current_user)]):
    company = models.Company(
        name=company_in.name,
        motivation=company_in.motivation,
        job_posting_url=company_in.job_posting_url,
        note=company_in.note,
    )
    db.add(company)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="この企業名は既に登録されています",
        )
    db.refresh(company)
    return company

# 企業情報更新
@router.put("/companies/{company_id}", response_model=CompanyOut)
def update_company(company_id: int, company_in: CompanyCreate, db: Annotated[Session, Depends(get_db)], current_user: Annotated[models.User, Depends(auth.get_current_user)]):
    company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="企業情報が見つかりません",
        )
    company.name = company_in.name
    company.motivation = company_in.motivation
    company.job_posting_url = company_in.job_posting_url
    company.note = company_in.note
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="この企業名は既に登録されています",
        )
    db.refresh(company)
    return company

# 企業情報削除
@router.delete("/companies/{company_id}", status_code=204)
def delete_company(company_id: int, db: Annotated[Session, Depends(get_db)], current_user: Annotated[models.User, Depends(auth.get_current_user)]):
    company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="企業情報が見つかりません",
        )
    db.delete(company)
    db.commit()
