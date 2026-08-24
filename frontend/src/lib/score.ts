/**
 * スコアの表示規則（共通仕様 9章）。
 * 総合スコア・項目別スコアはいずれも 0〜100 の整数で、S-04 / S-14 / S-16 で同じ見え方にする。
 */

export type ScoreLevel = "good" | "caution" | "improve";

/** 65〜100 良好 / 45〜64 注意 / 0〜44 要改善 */
export function scoreLevel(score: number): ScoreLevel {
  if (score >= 65) return "good";
  if (score >= 45) return "caution";
  return "improve";
}

/** 項目別スコアの数値に付ける色。総合スコアには色をつけない */
export const SCORE_TEXT_CLASS: Record<ScoreLevel, string> = {
  good: "text-accent",
  caution: "text-warning",
  improve: "text-danger",
};

/** スコアバーの色 */
export const SCORE_BAR_CLASS: Record<ScoreLevel, string> = {
  good: "bg-accent",
  caution: "bg-warning",
  improve: "bg-danger",
};

/** 話す速さの適正域（S-14 4.3 / S-12） */
export const SPEAKING_SPEED_RANGE = { min: 280, max: 320 } as const;

function normalizedScore(score: number): number {
  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * #57 確定までの暫定基準。
 * 適正域を100点とし、範囲から2文字/分離れるごとに1点減点する。
 */
export function scoreSpeakingSpeed(charsPerMinute: number): number {
  const { min, max } = SPEAKING_SPEED_RANGE;
  const distance =
    charsPerMinute < min
      ? min - charsPerMinute
      : charsPerMinute > max
        ? charsPerMinute - max
        : 0;
  return normalizedScore(100 - distance / 2);
}

/** #57 確定までの暫定基準。1回/分ごとに15点減点する。 */
export function scoreFillerRate(fillersPerMinute: number): number {
  return normalizedScore(100 - fillersPerMinute * 15);
}

/**
 * 文字入力を含み「回/分」を出せない場合の暫定基準。
 * 1回答あたり1回ごとに20点減点する。
 */
export function scoreFillersPerAnswer(fillersPerAnswer: number): number {
  return normalizedScore(100 - fillersPerAnswer * 20);
}

/** バーの長さはスコアをそのまま百分率にする（72点 → 72%） */
export function scorePercent(score: number): number {
  return Math.min(100, Math.max(0, score));
}
