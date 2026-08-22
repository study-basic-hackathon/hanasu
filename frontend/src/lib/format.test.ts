import { describe, expect, it } from "vitest";

import {
  formatClock,
  formatCount,
  formatDateTime,
  formatElapsed,
  formatFiller,
  formatSpeakingSpeed,
} from "@/lib/format";

describe("表示用フォーマット", () => {
  it("日時と時刻をゼロ埋めする", () => {
    expect(formatDateTime("2026-01-02T03:04:00")).toBe("2026-01-02 03:04");
    expect(formatClock("2026-01-02T03:04:00")).toBe("03:04");
  });

  it("経過時間は負数を 0 秒として扱い、秒を切り捨てる", () => {
    expect(formatElapsed(-1)).toBe("00:00");
    expect(formatElapsed(61.9)).toBe("01:01");
  });

  it("数値を画面仕様の単位と丸めで表示する", () => {
    expect(formatSpeakingSpeed(283.6)).toBe("284 文字/分");
    expect(formatFiller(11.6)).toBe("12 回");
    expect(formatFiller(11.6, 2.14)).toBe("12 回 / 2.1 回/分");
    expect(formatCount(12)).toBe("12 件");
  });
});
