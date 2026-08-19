import os

# LLM呼び出しレイヤー
#
# 認証は AWS のクレデンシャルチェーン任せ:
#   - ローカル: .env の AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY（compose が渡す）
#   - ECS: タスクロールで自動取得


def _call_bedrock(system: str, messages: list[dict], max_tokens: int, timeout: float) -> str:
    """Bedrock を1回呼んで応答テキストを返す。失敗は分かるメッセージの RuntimeError に変換する。"""
    import anthropic
    from anthropic import AnthropicBedrockMantle  # 遅延import

    # 既定値（タイムアウト10分・リトライ2回）だと障害時にワーカーを長時間占有するため明示する
    client = AnthropicBedrockMantle(
        aws_region=os.getenv("AWS_REGION", "ap-northeast-1"),
        timeout=timeout,
        max_retries=1,
    )

    try:
        response = client.messages.create(
            # Bedrock のモデルIDは "anthropic." プレフィックス付き。
            # getenv の第2引数でなく or なのは、compose が未設定時に空文字を注入するため（空でもフォールバックさせる）
            model=os.getenv("BEDROCK_MODEL_ID") or "anthropic.claude-opus-4-8",
            max_tokens=max_tokens,
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


def generate_reply(system: str, history: list[dict]) -> str:
    """system プロンプト＋会話履歴から、面接官の次の発言を1つ生成して返す。

    history: [{"role": "assistant" | "user", "content": "..."}, ...]
    """
    # Anthropic API は最初のメッセージが user である必要がある。
    # 履歴は面接官(assistant)の質問から始まるため、キックオフ用の user メッセージを常に先頭に置く。
    kickoff = {"role": "user", "content": "面接を開始してください。最初の質問をお願いします。"}
    return _call_bedrock(system, [kickoff, *history], max_tokens=300, timeout=30.0)


def evaluate_interview(company_name: str | None, turns: list[dict]) -> dict:
    """会話履歴から定性評価（構成・内容）を生成して dict で返す。

    LLM に渡すのは turns だけ（定量スコアは渡さない＝定量はコード、定性はLLM / ADR-0009）。
    返す形: {"score": int, "comment": str, "advice": [str, ...]}
    """
    import json

    target = f"応募先は「{company_name}」です。" if company_name else "チュートリアル（一般的な面接練習）です。"
    system = (
        f"あなたは採用面接の評価者です。{target}\n"
        "面接の会話履歴を読み、応募者の回答を「構成・内容」の観点で評価してください。\n"
        "%で囲まれた語（例: %えー%）は文字起こしが検出したフィラー（言い淀み）です。\n"
        "次のJSONだけを返してください（前置き・解説・コードブロック記法は禁止）:\n"
        '{"score": 0-100の整数, "comment": "評価コメント1〜2文", "advice": ["改善アドバイス", ...]}'
    )
    transcript = "\n".join(
        f"{'面接官' if t['role'] == 'assistant' else '応募者'}: {t['content']}" for t in turns
    )

    # バックグラウンド実行なのでチャットよりタイムアウトに余裕を持たせる（ユーザーを待たせない）
    text = _call_bedrock(
        system, [{"role": "user", "content": transcript or "（会話なし）"}], max_tokens=1000, timeout=60.0
    )
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"LLM の評価結果を JSON として読めませんでした: {text[:200]}") from e
