import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createEvaluation,
  getEvaluation,
  listEvaluations,
} from "@/lib/evaluation-api";
import { storeAccessToken } from "@/lib/token-storage";

describe("evaluation-api", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    window.sessionStorage.clear();
    storeAccessToken("jwt-token");
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8000");
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("一覧レスポンスの質問強度とターン数を保持する", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          evaluations: [
            {
              evaluation_id: 87,
              created_at: "2026-08-24T03:00:00Z",
              status: "processing",
              total_score: null,
              company_name: "株式会社テスト",
              question_strength: "hard",
              turn_count: 2,
              scores: null,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(listEvaluations()).resolves.toEqual([
      expect.objectContaining({
        evaluation_id: 87,
        company_id: null,
        question_strength: "hard",
        answer_method: null,
        turn_count: 2,
        advice: [],
      }),
    ]);
  });

  it("詳細レスポンスの質問強度とターン数を保持する", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          evaluation_id: 88,
          company_id: 3,
          company_name: "株式会社テスト",
          question_strength: "standard",
          turn_count: 4,
          status: "completed",
          created_at: "2026-08-29T12:00:00Z",
          total_score: 80,
          scores: {
            structure_content: { score: 80, comment: "良い回答です" },
          },
          advice: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(getEvaluation(88)).resolves.toEqual(
      expect.objectContaining({
        evaluation_id: 88,
        question_strength: "standard",
        turn_count: 4,
      }),
    );
  });

  it("評価 API へ未加工 STT テキストと定量スコアを送る", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ evaluation_id: 88 }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      createEvaluation({
        companyId: 1,
        questionStrength: "hard",
        answerMethod: "voice",
        turns: [
          { role: "assistant", content: "自己紹介をお願いします。" },
          {
            role: "user",
            content: "開発を経験しました。",
            raw_content: "えー、開発を経験しました。",
          },
        ],
        scores: {
          speaking_speed: { score: 80, value: 300, unit: "文字/分" },
          filler: {
            score: 75,
            value: 2,
            unit: "回",
            value_per_minute: 1,
          },
        },
      }),
    ).resolves.toBe(88);

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toEqual({
      company_id: 1,
      question_strength: "hard",
      answer_method: "voice",
      turn_count: 1,
      turns: [
        { role: "assistant", content: "自己紹介をお願いします。" },
        { role: "user", content: "えー、開発を経験しました。" },
      ],
      scores: {
        speaking_speed: { score: 80, value: 300, unit: "文字/分" },
        filler: { score: 75, value: 2, unit: "回", value_per_minute: 1 },
      },
    });
  });
});
