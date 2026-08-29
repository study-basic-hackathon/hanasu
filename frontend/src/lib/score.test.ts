import { describe, expect, it } from "vitest";

import {
  SCORE_BAR_CLASS,
  SCORE_TEXT_CLASS,
  SPEAKING_SPEED_RANGE,
  scoreFillerRate,
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
    expect(SPEAKING_SPEED_RANGE).toEqual({ min: 240, max: 260 });
  });
});

describe("scoreSpeakingSpeed", () => {
  it.each([
    [0, 0],
    [100, 50],
    [240, 100],
    [260, 100],
    [350, 70],
    [400, 40],
    [500, 10],
  ])("基準点 %i 文字/分を %i 点にする", (value, expected) => {
    expect(scoreSpeakingSpeed(value)).toBe(expected);
  });

  it.each([
    [50, 25],
    [170, 75],
    [305, 85],
    [375, 55],
    [450, 25],
  ])("補間区間の %i 文字/分を %i 点にする", (value, expected) => {
    expect(scoreSpeakingSpeed(value)).toBe(expected);
  });

  it("丸め前の実測値で補間し、補間後の0.5を切り上げる", () => {
    expect(scoreSpeakingSpeed(107)).toBe(53);
    expect(scoreSpeakingSpeed(264.5)).toBe(99);
  });

  it("満点域と上下限の点数に固定する", () => {
    expect(scoreSpeakingSpeed(-1)).toBe(0);
    expect(scoreSpeakingSpeed(250)).toBe(100);
    expect(scoreSpeakingSpeed(600)).toBe(10);
  });
});

describe("scoreFillerRate", () => {
  it.each([
    [0, 100],
    [5, 100],
    [10, 50],
    [15, 20],
    [20, 0],
  ])("基準点 %i 回/分を %i 点にする", (value, expected) => {
    expect(scoreFillerRate(value)).toBe(expected);
  });

  it.each([
    [7.5, 75],
    [12.5, 35],
    [17.5, 10],
  ])("補間区間の %i 回/分を %i 点にする", (value, expected) => {
    expect(scoreFillerRate(value)).toBe(expected);
  });

  it("上下限の点数に固定する", () => {
    expect(scoreFillerRate(3)).toBe(100);
    expect(scoreFillerRate(25)).toBe(0);
  });
});
