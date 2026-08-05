from app import models
from app.database import SessionLocal
from app.security import hash_password

# 開発用: テストユーザーを1人シード（登録フローが無いので手で入れる代わり）
# TODO: 本物の事前発行ユーザーに差し替え（パスワードは環境変数/.envから読む）
def seed_user():
    db = SessionLocal()
    try:
        if not db.query(models.User).filter(models.User.login_id == "testuser").first():
            db.add(
                models.User(
                    login_id="testuser",
                    password_hash=hash_password("testpass"),
                )
            )
            db.commit()
    finally:
        db.close()
