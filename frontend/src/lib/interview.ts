import type { ReadAloudMode } from "@/lib/domain";

/**
 * 面接の進行に関する値（S-08 の詳細仕様）。
 * サーバーは終了を判断しないため、ターン数の上限と最初の質問はフロントが持つ（ADR-0008）。
 */

/** 本番モードの最大ターン数。S-05 でこの範囲の整数を設定する。 */
export const MIN_MAX_TURNS = 1;
export const DEFAULT_MAX_TURNS = 10;
export const MAX_MAX_TURNS = 25;

/** 読み上げ設定がURLにない、または不正な場合の本番モード既定値。 */
export const DEFAULT_READ_ALOUD_MODE: ReadAloudMode = "enabled";

export function resolveReadAloudMode(value: string | null): ReadAloudMode {
  return value === "enabled" || value === "disabled"
    ? value
    : DEFAULT_READ_ALOUD_MODE;
}

/** チュートリアルは自己紹介1問で終わる（S-08 9章） */
export const TUTORIAL_MAX_TURNS = 1;

/** 最初の質問。POST /interviews/start を作らない場合はこの固定文字列を使う */
export const FIRST_QUESTION =
  "それでは始めます。まずは自己紹介をお願いします。これまでのご経歴と、現在のお仕事の内容を1分程度でお話しください。";

/** チュートリアルの質問は固定（S-08 9章） */
export const TUTORIAL_QUESTION = "1分で自己紹介してください。";

/** S-05 の入力値を検証する。範囲外・小数・数値以外は受け付けない。 */
export function parseMaxTurns(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) &&
    parsed >= MIN_MAX_TURNS &&
    parsed <= MAX_MAX_TURNS
    ? parsed
    : null;
}

/** S-08 の URL に有効な設定がなければ既定値へフォールバックする。 */
export function resolveMaxTurns(value: string | null): number {
  return parseMaxTurns(value) ?? DEFAULT_MAX_TURNS;
}

/**
 * 音声入力モードの常時録音（S-08 6.1）。
 * 面接中は録音を止めず、無音が続いたところで発話を1ターンとして区切る。
 * 無音の長さ・入力感度・読み上げ速度は面接中に設定パネルで変えられる。
 */

/** 発話を区切る無音の長さ（秒） */
export const DEFAULT_SILENCE_SECONDS = 2;
export const MIN_SILENCE_SECONDS = 1;
export const MAX_SILENCE_SECONDS = 5;
export const SILENCE_SECONDS_STEP = 0.5;

/**
 * 入力レベルの閾値。平均レベルがこれ未満のあいだを無音とみなす。
 * 大きいほど環境音を無音として扱い、発話が区切られやすくなる。
 */
export const DEFAULT_INPUT_THRESHOLD = 12;
export const MIN_INPUT_THRESHOLD = 2;
export const MAX_INPUT_THRESHOLD = 30;

/** 面接官の読み上げ速度（倍）。文字入力モードは既定値で固定する */
export const DEFAULT_SPEECH_PLAYBACK_RATE = 1.2;
export const MIN_SPEECH_PLAYBACK_RATE = 0.8;
export const MAX_SPEECH_PLAYBACK_RATE = 2;
export const SPEECH_PLAYBACK_RATE_STEP = 0.1;

/** 1回の発話の最長（秒）。超えたら区切って送る */
export const RECORDING_MAX_SECONDS = 180;

/** 1回の発話の最短（秒）。これに満たない区間は送らずに捨てる */
export const RECORDING_MIN_SECONDS = 1;

/** 設定パネルのスライダーが受け取る値を範囲に収める */
export function clampToRange(
  value: number,
  min: number,
  max: number,
  fallback: number,
): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/**
 * フィラーとして数える語。
 * 本来は AmiVoice が `%えー%` の形で返したものを数える（ADR-0010）。
 * モックでは文字入力の回答からも数えられるよう、代表的な語を並べておく。
 */
const FILLER_WORDS = ["えー", "えっと", "あのー", "あの", "まあ", "そのー"];

export function countFillers(text: string): number {
  return FILLER_WORDS.reduce(
    (total, word) => total + text.split(word).length - 1,
    0,
  );
}
