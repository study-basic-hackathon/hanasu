import { beforeEach, describe, expect, it } from "vitest";

import {
  loadEvaluationSession,
  storeEvaluationSession,
  type EvaluationSession,
} from "@/lib/evaluation-session";

const session: EvaluationSession = {
  companyId: 1,
  companyName: "株式会社テスト",
  questionStrength: "standard",
  answerMethod: "voice",
  turns: [{ role: "user", content: "回答" }],
  scores: {
    filler: { score: 100, value: 0, unit: "回", value_per_minute: 0 },
  },
};

describe("evaluation-session", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("評価 ID ごとに再実行用データを保存する", () => {
    storeEvaluationSession(87, session);
    expect(loadEvaluationSession(87)).toEqual(session);
    expect(loadEvaluationSession(88)).toBeNull();
  });

  it("壊れた保存値は利用しない", () => {
    window.sessionStorage.setItem("hanasu.evaluationSession.87", "{");
    expect(loadEvaluationSession(87)).toBeNull();
  });
});
