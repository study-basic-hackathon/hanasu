import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

# JWT の設定
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not JWT_SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY が未設定です（環境変数で必ず設定してください）")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

def hash_password(password: str) -> str:
    """平文パスワード → bcryptハッシュ（保存用）"""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    """入力パスワードが、保存されたハッシュと一致するか"""
    pw = password.encode()
    # bcrypt(>=5.0)は72バイト超で ValueError を投げるので確認
    if len(pw) > 72:
        return False
    return bcrypt.checkpw(pw, password_hash.encode())


# --- JWT（トークン） ---
def create_access_token(sub: str) -> str:
    """sub(ログインID)を入れたJWTを発行"""
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": sub, "exp": expire}
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> str | None:
    """JWTを検証して sub(ログインID)を取り出す。ダメなら None"""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload.get("sub")
    except jwt.PyJWTError:
        return None
