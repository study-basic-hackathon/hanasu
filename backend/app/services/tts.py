import os

# 認証は llm.py と同じく AWS のクレデンシャルチェーン任せ:
#   - ローカル: .env の AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY（compose が渡す）
#   - ECS: タスクロールで自動取得


def synthesize(text: str) -> bytes:
    """発言全体を1回で音声化して mp3 バイト列を返す。

    失敗は分かるメッセージの RuntimeError に変換する（ルーターが 503 にする）。
    """
    import boto3  # 遅延import
    from botocore.config import Config

    try:
        client = boto3.client(
            "polly",
            region_name=os.getenv("AWS_REGION", "ap-northeast-1"),
            # 既定値だと障害時に長時間待つため明示する
            config=Config(connect_timeout=5, read_timeout=30, retries={"max_attempts": 1}),
        )
        response = client.synthesize_speech(
            Engine="neural",
            VoiceId=os.getenv("POLLY_VOICE_ID") or "Tomoko",
            Text=text,
            OutputFormat="mp3",
        )
        return response["AudioStream"].read()
    except Exception as e:
        # NoCredentialsError / ClientError 等をまとめて分かるメッセージにする
        raise RuntimeError(f"Polly 呼び出しに失敗しました（AWS認証情報・権限を確認）: {e}") from e
