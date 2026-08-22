import json
import os

import boto3
from botocore.exceptions import ClientError
from fastapi import FastAPI, HTTPException
from sqlalchemy import select

from db import SessionLocal
from models import Item

app = FastAPI()

bedrock_runtime = boto3.client("bedrock-runtime", region_name=os.environ.get("BEDROCK_REGION", "ap-northeast-1"))
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "anthropic.claude-sonnet-4-6")


@app.get("/")
def health_check():
    return {"status": "ok"}


@app.get("/items")
def list_items():
    with SessionLocal() as session:
        items = session.scalars(select(Item)).all()
        return [{"id": item.id, "name": item.name} for item in items]


@app.get("/bedrock/test")
def bedrock_test():
    body = json.dumps(
        {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 256,
            "messages": [{"role": "user", "content": "こんにちは。一言だけ返信してください。"}],
        }
    )
    try:
        response = bedrock_runtime.invoke_model(modelId=BEDROCK_MODEL_ID, body=body)
    except ClientError as e:
        # モデルID・アクセス許可の確認用にBedrock側のエラーをそのまま返す
        raise HTTPException(status_code=502, detail=str(e)) from e

    payload = json.loads(response["body"].read())
    return {"model": BEDROCK_MODEL_ID, "reply": payload["content"][0]["text"]}
