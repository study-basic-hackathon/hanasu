import os
import re

import httpx

# AmiVoice APIの音声認識エンドポイント（1リクエスト=1音声ファイルの同期呼び出し）
_AMIVOICE_RECOGNIZE_URL = "https://acp-api.amivoice.com/v1/recognize"

# フィラーは keepFillerToken=1 により %えー% の形で返る（ADR-0010）
_FILLER_TOKEN_RE = re.compile(r"%[^%]+%")


def _call_amivoice(audio: bytes, filename: str) -> dict:
    """AmiVoiceの音声認識APIを1回呼び、レスポンスのJSONを返す。失敗は分かるメッセージのRuntimeErrorに変換する。"""
    api_key = os.getenv("AMIVOICE_API_KEY")
    if not api_key:
        raise RuntimeError("AMIVOICE_API_KEY が設定されていません")

    # grammarFileNamesは汎用の日本語モデル。keepFillerToken=1は必須（フィラー計測の前提、ADR-0010）
    params = f"grammarFileNames=-a-general keepFillerToken=1 authorization={api_key}"

    try:
        response = httpx.post(
            _AMIVOICE_RECOGNIZE_URL,
            data={"d": params},
            files={"a": (filename, audio)},
            timeout=30.0,
        )
        response.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise RuntimeError(
            f"AmiVoice 呼び出しに失敗しました（HTTP {e.response.status_code}）: {e.response.text}"
        ) from e
    except httpx.HTTPError as e:
        raise RuntimeError(f"AmiVoice に接続できません: {e}") from e

    result = response.json()
    if result.get("code"):
        raise RuntimeError(f"AmiVoice がエラーを返しました: {result.get('message') or result['code']}")
    return result


def transcribe(audio: bytes, filename: str) -> dict:
    """音声を文字起こしし、raw/clean transcript・フィラー数・話速指標をまとめて返す。

    raw_transcriptはフィラー込みのまま返す（評価に使うため捨てない。API仕様5.2）。
    話速は clean_transcript の文字数 ÷ 発話時間（AmiVoiceが返す発話区間の終端時刻）で算出する。
    """
    result = _call_amivoice(audio, filename)

    raw_transcript = result.get("text", "")
    filler_count = len(_FILLER_TOKEN_RE.findall(raw_transcript))
    clean_transcript = _FILLER_TOKEN_RE.sub("", raw_transcript).strip()

    results = result.get("results") or []
    duration_ms = max((r.get("endtime") or 0) for r in results) if results else 0

    chars = len(clean_transcript)
    chars_per_min = round(chars / (duration_ms / 60000)) if duration_ms > 0 else 0
    filler_count_per_min = round(filler_count / (duration_ms / 60000), 1) if duration_ms > 0 else 0.0

    return {
        "raw_transcript": raw_transcript,
        "clean_transcript": clean_transcript,
        "filler_count": filler_count,
        "filler_count_per_min": filler_count_per_min,
        "duration_ms": duration_ms,
        "chars": chars,
        "chars_per_min": chars_per_min,
    }
