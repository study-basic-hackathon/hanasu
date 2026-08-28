import { describe, expect, it } from "vitest";

import { buildEvaluationScores } from "@/lib/evaluation-score";

describe("buildEvaluationScores", () => {
  it("音声回答を合算して話速と毎分フィラーを算出する", () => {
    expect(
      buildEvaluationScores([
        { role: "assistant", content: "質問" },
        {
          role: "user",
          content: "回答1",
          audio_duration_ms: 30_000,
          character_count: 150,
          filler_count: 1,
        },
        { role: "assistant", content: "質問2" },
        {
          role: "user",
          content: "回答2",
          audio_duration_ms: 30_000,
          character_count: 150,
          filler_count: 1,
        },
      ]),
    ).toEqual({
      speaking_speed: {
        score: 85,
        value: 300,
        unit: "文字/分",
      },
      filler: {
        score: 100,
        value: 2,
        unit: "回",
        value_per_minute: 2,
      },
    });
  });

  it("計測値のない回答だけなら定量スコアを作らない", () => {
    expect(
      buildEvaluationScores([
        { role: "user", content: "回答1", filler_count: 1 },
        { role: "user", content: "回答2", filler_count: 2 },
      ]),
    ).toEqual({});
  });

  it("欠測回答を除外し、計測できた音声回答だけを指標別に合算する", () => {
    expect(
      buildEvaluationScores([
        {
          role: "user",
          content: "音声回答1",
          audio_duration_ms: 20_000,
          character_count: 100,
          filler_count: 1,
        },
        {
          role: "user",
          content: "時間欠測の音声回答",
          character_count: 1_000,
          filler_count: 10,
        },
        {
          role: "user",
          content: "文字回答",
          filler_count: 20,
        },
        {
          role: "user",
          content: "話速だけ計測できた回答",
          audio_duration_ms: 40_000,
          character_count: 100,
        },
        {
          role: "user",
          content: "フィラーだけ計測できた回答",
          audio_duration_ms: 40_000,
          filler_count: 1,
        },
      ]),
    ).toEqual({
      speaking_speed: {
        score: 100,
        value: 200,
        unit: "文字/分",
      },
      filler: {
        score: 100,
        value: 2,
        unit: "回",
        value_per_minute: 2,
      },
    });
  });

  it("負の計測値を対象から除外する", () => {
    expect(
      buildEvaluationScores([
        {
          role: "user",
          content: "無効な回答",
          audio_duration_ms: 60_000,
          character_count: -1,
          filler_count: -1,
        },
      ]),
    ).toEqual({});
  });

  it("表示値を丸める前の話速で点数化する", () => {
    expect(
      buildEvaluationScores([
        {
          role: "user",
          content: "回答",
          audio_duration_ms: 300_000,
          character_count: 503,
        },
      ]),
    ).toEqual({
      speaking_speed: {
        score: 50,
        value: 101,
        unit: "文字/分",
      },
    });
  });

  it("表示値を丸める前の毎分フィラー数で点数化する", () => {
    expect(
      buildEvaluationScores([
        {
          role: "user",
          content: "回答",
          audio_duration_ms: 29_703,
          filler_count: 2,
        },
      ]),
    ).toEqual({
      filler: {
        score: 66,
        value: 2,
        unit: "回",
        value_per_minute: 4,
      },
    });
  });

  it("回答がなければ評価を作らない", () => {
    expect(() =>
      buildEvaluationScores([{ role: "assistant", content: "質問" }]),
    ).toThrow("1件以上の回答");
  });
});
