import { describe, expect, it } from "vitest";

import {
  DEFAULT_MAX_TURNS,
  DEFAULT_READ_ALOUD_MODE,
  DEFAULT_SILENCE_SECONDS,
  FIRST_QUESTION,
  MAX_MAX_TURNS,
  MIN_MAX_TURNS,
  RECORDING_MAX_SECONDS,
  RECORDING_MIN_SECONDS,
  TUTORIAL_MAX_TURNS,
  TUTORIAL_QUESTION,
  countFillers,
  parseMaxTurns,
  resolveMaxTurns,
  resolveReadAloudMode,
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
    expect(MIN_MAX_TURNS).toBe(1);
    expect(DEFAULT_MAX_TURNS).toBe(10);
    expect(MAX_MAX_TURNS).toBe(25);
    expect(TUTORIAL_MAX_TURNS).toBe(1);
    expect(DEFAULT_SILENCE_SECONDS).toBe(3);
    expect(RECORDING_MIN_SECONDS).toBe(1);
    expect(RECORDING_MAX_SECONDS).toBe(180);
    expect(FIRST_QUESTION).toContain("自己紹介");
    expect(TUTORIAL_QUESTION).toBe("1分で自己紹介してください。");
  });
});

describe("最大ターン数", () => {
  it.each(["1", "10", "25"])("有効な境界値 %s を受け付ける", (value) => {
    expect(parseMaxTurns(value)).toBe(Number(value));
  });

  it.each([null, "", "0", "26", "1.5", "abc"])(
    "不正値 %s を受け付けない",
    (value) => {
      expect(parseMaxTurns(value)).toBeNull();
    },
  );

  it.each([null, "", "0", "26", "1.5", "abc"])(
    "URL の欠落・不正値 %s は10ターンへフォールバックする",
    (value) => {
      expect(resolveMaxTurns(value)).toBe(10);
    },
  );
});

describe("読み上げモード", () => {
  it("有効なURL値をそのまま採用する", () => {
    expect(resolveReadAloudMode("enabled")).toBe("enabled");
    expect(resolveReadAloudMode("disabled")).toBe("disabled");
  });

  it.each([null, "", "true", "invalid"])(
    "URLの欠落・不正値 %s は読み上げるへフォールバックする",
    (value) => {
      expect(DEFAULT_READ_ALOUD_MODE).toBe("enabled");
      expect(resolveReadAloudMode(value)).toBe("enabled");
    },
  );
});
