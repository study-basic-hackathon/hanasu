import os

# LLM呼び出しレイヤー（Bedrock 経由で Claude を呼ぶ）。
# ルーターはこの generate_reply() だけを呼ぶ。プロバイダの都合はこのファイルに閉じ込める。
#
# 認証は AWS のクレデンシャルチェーン任せ:
#   - ローカル: .env の AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY（compose が渡す）
#   - ECS: タスクロール(#28)で自動取得（環境変数不要）


def generate_reply(system: str, history: list[dict]) -> str:
    """system プロンプト＋会話履歴から、面接官の次の発言を1つ生成して返す。

    history: [{"role": "assistant" | "user", "content": "..."}, ...]
    """
    import anthropic
    from anthropic import AnthropicBedrockMantle  # 遅延import

    client = AnthropicBedrockMantle(aws_region=os.getenv("AWS_REGION", "ap-northeast-1"))

    # Anthropic API は最初のメッセージが user である必要がある。
    # 履歴が空（面接の1問目）はキックオフ用の user メッセージを立てる。
    messages = history or [{"role": "user", "content": "面接を開始してください。最初の質問をお願いします。"}]

    try:
        response = client.messages.create(
            # Bedrock のモデルIDは "anthropic." プレフィックス付き
            model=os.getenv("BEDROCK_MODEL_ID", "anthropic.claude-opus-4-8"),
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
