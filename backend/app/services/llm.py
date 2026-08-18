import os

# LLM呼び出しレイヤー
#
# 認証は AWS のクレデンシャルチェーン任せ:
#   - ローカル: .env の AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY（compose が渡す）
#   - ECS: タスクロールで自動取得

def generate_reply(system: str, history: list[dict]) -> str:
    """system プロンプト＋会話履歴から、面接官の次の発言を1つ生成して返す。

    history: [{"role": "assistant" | "user", "content": "..."}, ...]
    """
    import anthropic
    from anthropic import AnthropicBedrockMantle  # 遅延import

    # 既定値（タイムアウト10分・リトライ2回）だと障害時にワーカーを長時間占有するため明示する。
    # 最悪ケースは60秒
    client = AnthropicBedrockMantle(
        aws_region=os.getenv("AWS_REGION", "ap-northeast-1"),
        timeout=30.0,
        max_retries=1,
    )

    # Anthropic API は最初のメッセージが user である必要がある。
    # 履歴は面接官(assistant)の質問から始まるため、キックオフ用の user メッセージを常に先頭に置く。
    kickoff = {"role": "user", "content": "面接を開始してください。最初の質問をお願いします。"}
    messages = [kickoff, *history]

    try:
        response = client.messages.create(
            # Bedrock のモデルIDは "anthropic." プレフィックス付き。
            # getenv の第2引数でなく or なのは、compose が未設定時に空文字を注入するため（空でもフォールバックさせる）
            model=os.getenv("BEDROCK_MODEL_ID") or "anthropic.claude-opus-4-8",
            max_tokens=300,
            system=system,
            messages=messages,
        )
    except anthropic.RateLimitError as e:
        raise RuntimeError(f"Bedrock が利用制限を返しました: {e}") from e
    except anthropic.APIStatusError as e:
        raise RuntimeError(f"Bedrock 呼び出しに失敗しました（HTTP {e.status_code}）: {e.message}") from e
    except anthropic.APIConnectionError as e:
        raise RuntimeError(f"Bedrock に接続できません（認証・リージョン・ネットワークを確認）: {e}") from e
    except Exception as e:
        # boto3 側の NoCredentialsError 等もここで拾って分かるメッセージにする
        raise RuntimeError(f"Bedrock 呼び出しに失敗しました（AWS認証情報を確認）: {e}") from e

    text = "".join(block.text for block in response.content if block.type == "text")
    if not text.strip():
        raise RuntimeError("LLM が空の応答を返しました")
    return text.strip()
