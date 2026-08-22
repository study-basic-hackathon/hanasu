import { describe, expect, it } from "vitest";

import {
  FIRST_QUESTION,
  MAX_TURNS,
  RECORDING_MAX_SECONDS,
  RECORDING_MIN_SECONDS,
  SILENCE_LIMIT_SECONDS,
  TUTORIAL_MAX_TURNS,
  TUTORIAL_QUESTION,
  countFillers,
} from "@/lib/interview";

describe("countFillers", () => {
  it("登録されたフィラーを出現回数ごとに数える", () => {
    expect(countFillers("えー、あの、えっと、そのー、まあ、えー"))
      .toBe(6);
  });

  it("フィラーがなければ 0 を返す", () => {
    expect(countFillers("よろしくお願いします")).toBe(0);
  });
});

describe("面接進行の定数", () => {
  it("画面仕様どおりの制限値と開始質問を提供する", () => {
    expect(MAX_TURNS).toBe(8);
    expect(TUTORIAL_MAX_TURNS).toBe(1);
    expect(SILENCE_LIMIT_SECONDS).toBe(3);
    expect(RECORDING_MIN_SECONDS).toBe(1);
    expect(RECORDING_MAX_SECONDS).toBe(180);
    expect(FIRST_QUESTION).toContain("自己紹介");
    expect(TUTORIAL_QUESTION).toBe("1分で自己紹介してください。");
  });
});
