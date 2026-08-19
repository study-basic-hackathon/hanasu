from app import models
from app.database import SessionLocal
from app.security import hash_password

# 開発用: テストユーザーを1人シード（登録フローが無いので手で入れる代わり）
# TODO: 本物の事前発行ユーザーに差し替え（パスワードは環境変数/.envから読む）
def seed_user():
    db = SessionLocal()
    try:
        if not db.query(models.User).filter(models.User.username == "testuser").first():
            db.add(
                models.User(
                    username="testuser",
                    password_hash=hash_password("testpass"),
                )
            )
            db.commit()
    finally:
        db.close()


# 【開発用・削除予定】評価履歴のサンプルデータ。
# 書く側の POST /evaluations が未実装のため、一覧・詳細の動作確認とフロント開発用に置いている。
# POST /evaluations が実装されたらこの関数ごと消してよい。
# status 3種すべてと「企業なし（チュートリアル）」を網羅する
def seed_evaluations():
    db = SessionLocal()
    try:
        if db.query(models.Evaluation).first():
            return
        # 評価の持ち主は seed_user が入れた testuser（seed_user が先に実行される前提）
        user = db.query(models.User).filter(models.User.username == "testuser").first()
        if user is None:
            return
        db.add_all(
            [
                models.Evaluation(
                    user_id=user.id,
                    company_name="テスト株式会社",
                    status="completed",
                    total_score=72,
                    scores={
                        "speaking_speed": {"score": 80, "value": 284, "unit": "文字/分"},
                        "filler": {"score": 55, "value": 14, "unit": "回"},
                        "structure_content": {"score": 72, "comment": "結論が後半に来る回答が目立つ。具体例は良い"},
                    },
                    advice=["「結論 → 理由 → 具体例」の順で話すと伝わりやすくなります"],
                ),
                models.Evaluation(
                    # チュートリアル（企業なし）
                    user_id=user.id,
                    status="completed",
                    total_score=65,
                    scores={
                        "speaking_speed": {"score": 70, "value": 310, "unit": "文字/分"},
                        "filler": {"score": 60, "value": 11, "unit": "回"},
                        "structure_content": {"score": 65, "comment": "話の要点は明確。根拠の提示が少ない"},
                    },
                    advice=["主張のあとに理由を一言添えると説得力が上がります"],
                ),
                models.Evaluation(user_id=user.id, status="processing"),
                models.Evaluation(user_id=user.id, status="failed", error="LLM 呼び出しに失敗しました"),
            ]
        )
        db.commit()
    finally:
        db.close()
