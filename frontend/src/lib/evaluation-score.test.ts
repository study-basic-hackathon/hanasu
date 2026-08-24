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
        score: 100,
        value: 300,
        unit: "文字/分",
      },
      filler: {
        score: 70,
        value: 2,
        unit: "回",
        value_per_minute: 2,
      },
    });
  });

  it("文字入力だけなら話速を作らず1回答あたりのフィラーで採点する", () => {
    expect(
      buildEvaluationScores([
        { role: "user", content: "回答1", filler_count: 1 },
        { role: "user", content: "回答2", filler_count: 2 },
      ]),
    ).toEqual({
      filler: { score: 70, value: 3, unit: "回" },
    });
  });

  it("回答がなければ評価を作らない", () => {
    expect(() =>
      buildEvaluationScores([{ role: "assistant", content: "質問" }]),
    ).toThrow("1件以上の回答");
  });
});
