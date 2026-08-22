import { describe, expect, it } from "vitest";

import {
  SCORE_BAR_CLASS,
  SCORE_TEXT_CLASS,
  SPEAKING_SPEED_RANGE,
  scoreLevel,
  scorePercent,
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
