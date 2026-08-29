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

/** 話す速さが100点となる範囲（評価仕様 4.3 / S-14 4.3 / S-12） */
export const SPEAKING_SPEED_RANGE = { min: 240, max: 260 } as const;

function normalizedScore(score: number): number {
  return Math.min(100, Math.max(0, Math.round(score)));
}

function interpolateScore(
  value: number,
  from: readonly [value: number, score: number],
  to: readonly [value: number, score: number],
): number {
  const [fromValue, fromScore] = from;
  const [toValue, toScore] = to;
  return normalizedScore(
    fromScore +
      ((value - fromValue) * (toScore - fromScore)) /
        (toValue - fromValue),
  );
}

/** 評価仕様 4.3 の基準点間を線形補間して話速を点数化する。 */
export function scoreSpeakingSpeed(charsPerMinute: number): number {
  if (charsPerMinute <= 0) return 0;
  if (charsPerMinute < 100) {
    return interpolateScore(charsPerMinute, [0, 0], [100, 50]);
  }
  if (charsPerMinute < SPEAKING_SPEED_RANGE.min) {
    return interpolateScore(
      charsPerMinute,
      [100, 50],
      [SPEAKING_SPEED_RANGE.min, 100],
    );
  }
  if (charsPerMinute <= SPEAKING_SPEED_RANGE.max) return 100;
  if (charsPerMinute < 350) {
    return interpolateScore(
      charsPerMinute,
      [SPEAKING_SPEED_RANGE.max, 100],
      [350, 70],
    );
  }
  if (charsPerMinute < 400) {
    return interpolateScore(charsPerMinute, [350, 70], [400, 40]);
  }
  if (charsPerMinute < 500) {
    return interpolateScore(charsPerMinute, [400, 40], [500, 10]);
  }
  return 10;
}

/** 評価仕様 4.2 の基準点間を線形補間して毎分フィラー数を点数化する。 */
export function scoreFillerRate(fillersPerMinute: number): number {
  if (fillersPerMinute <= 2) return 100;
  if (fillersPerMinute < 5) {
    return interpolateScore(fillersPerMinute, [2, 100], [5, 50]);
  }
  if (fillersPerMinute < 10) {
    return interpolateScore(fillersPerMinute, [5, 50], [10, 20]);
  }
  if (fillersPerMinute < 15) {
    return interpolateScore(fillersPerMinute, [10, 20], [15, 0]);
  }
  return 0;
}

/** バーの長さはスコアをそのまま百分率にする（72点 → 72%） */
export function scorePercent(score: number): number {
  return Math.min(100, Math.max(0, score));
}
