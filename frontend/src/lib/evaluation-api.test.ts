import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createEvaluation,
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

  it("一覧レスポンスにバックエンド未提供の実施条件を null で補う", async () => {
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
        question_strength: null,
        answer_method: null,
        turn_count: null,
        advice: [],
      }),
    ]);
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
