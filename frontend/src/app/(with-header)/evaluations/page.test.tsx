import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import EvaluationsPage from "@/app/(with-header)/evaluations/page";
import type { Evaluation } from "@/lib/domain";

const mocks = vi.hoisted(() => ({
  listEvaluations: vi.fn(),
}));

vi.mock("@/lib/evaluation-api", () => ({
  listEvaluations: mocks.listEvaluations,
}));

const textEvaluation: Evaluation = {
  evaluation_id: 125,
  company_id: 1,
  company_name: "株式会社テスト",
  question_strength: "standard",
  answer_method: "text",
  turn_count: 2,
  status: "completed",
  created_at: "2026-08-29T10:00:00+09:00",
  total_score: 72,
  scores: {
    structure_content: { score: 72, comment: "結論が明確です。" },
  },
  advice: [],
};

describe("EvaluationsPage の計測対象外表示", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listEvaluations.mockResolvedValue([textEvaluation]);
  });

  afterEach(() => cleanup());

  it("フィラーのない評価も3本の配置を保ち、定量2本を空で表示する", async () => {
    render(<EvaluationsPage />);

    const row = await screen.findByRole("link", { name: /株式会社テスト/ });
    const tracks = [...row.querySelectorAll<HTMLElement>(".bg-track")];

    expect(tracks).toHaveLength(3);
    expect(tracks[0]).toBeEmptyDOMElement();
    expect(tracks[1]).toBeEmptyDOMElement();
    expect(tracks[2].firstElementChild).toHaveStyle({ width: "72%" });
  });
});
