import { describe, expect, it } from "vitest";

import {
  SCORE_BAR_CLASS,
  SCORE_TEXT_CLASS,
  SPEAKING_SPEED_RANGE,
  scoreFillerRate,
  scoreFillersPerAnswer,
  scoreLevel,
  scorePercent,
  scoreSpeakingSpeed,
} from "@/lib/score";

describe("scoreLevel", () => {
  it.each([
    [65, "good"],
    [64, "caution"],
    [45, "caution"],
    [44, "improve"],
  ] as const)("%i 点は %s", (score, level) => {
    expect(scoreLevel(score)).toBe(level);
  });
});

describe("scorePercent", () => {
  it("スコアを 0〜100 に収める", () => {
    expect(scorePercent(-10)).toBe(0);
    expect(scorePercent(72)).toBe(72);
    expect(scorePercent(150)).toBe(100);
  });
});

describe("スコア表示の定数", () => {
  it("各レベルの色と話す速さの適正域を提供する", () => {
    expect(SCORE_TEXT_CLASS.good).toBe("text-accent");
    expect(SCORE_BAR_CLASS.improve).toBe("bg-danger");
    expect(SPEAKING_SPEED_RANGE).toEqual({ min: 280, max: 320 });
  });
});

describe("暫定の定量スコア", () => {
  it.each([
    [280, 100],
    [300, 100],
    [320, 100],
    [260, 90],
    [340, 90],
    [80, 0],
    [520, 0],
  ])("話速 %i 文字/分を %i 点にする", (value, expected) => {
    expect(scoreSpeakingSpeed(value)).toBe(expected);
  });

  it("フィラーを0〜100点に収める", () => {
    expect(scoreFillerRate(0)).toBe(100);
    expect(scoreFillerRate(2)).toBe(70);
    expect(scoreFillerRate(10)).toBe(0);
    expect(scoreFillersPerAnswer(1.5)).toBe(70);
  });
});
