import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "@/app/(with-header)/page";
import type { Evaluation, QuantitativeScore } from "@/lib/domain";

const mocks = vi.hoisted(() => ({
  listCompanies: vi.fn(),
  listEvaluations: vi.fn(),
}));

vi.mock("@/lib/company-api", () => ({
  listCompanies: mocks.listCompanies,
}));

vi.mock("@/lib/evaluation-api", () => ({
  listEvaluations: mocks.listEvaluations,
}));

function completedEvaluation(filler?: QuantitativeScore): Evaluation {
  return {
    evaluation_id: 161,
    company_id: 1,
    company_name: "株式会社テスト",
    question_strength: "standard",
    answer_method: "voice",
    turn_count: 8,
    status: "completed",
    created_at: "2026-08-28T10:00:00+09:00",
    total_score: 70,
    scores: {
      speaking_speed: { score: 72, value: 284, unit: "文字/分" },
      filler,
      structure_content: { score: 75, comment: "結論が明確です。" },
    },
    advice: [],
  };
}

function fillerRow(): HTMLElement {
  const row = screen.getByText("フィラーの数").parentElement?.parentElement;
  if (!row) throw new Error("フィラーの行が見つかりません。");
  return row;
}

function scoreBar(container: HTMLElement): HTMLElement {
  const bar = container.querySelector<HTMLElement>(".bg-track");
  if (!bar) throw new Error("スコアバーが見つかりません。");
  return bar;
}

describe("HomePage のフィラー表示", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listCompanies.mockResolvedValue([]);
  });

  afterEach(() => cleanup());

  it("直近評価では合計回数を出さず、小数第1位の毎分値だけを表示する", async () => {
    mocks.listEvaluations.mockResolvedValue([
      completedEvaluation({
        score: 64,
        value: 2,
        unit: "回",
        value_per_minute: 9,
      }),
    ]);

    render(<HomePage />);

    await screen.findByText("フィラーの数");
    const row = fillerRow();
    expect(row).toHaveTextContent("64 / 9.0 回/分");
    expect(row).not.toHaveTextContent("2 回");
    expect(row.firstElementChild?.lastElementChild).toHaveClass(
      "text-warning",
    );
    expect(scoreBar(row).firstElementChild).toHaveClass("bg-warning");
    expect(scoreBar(row).firstElementChild).toHaveStyle({ width: "64%" });
  });

  it("計測できない場合はスコアと実測値を表示せず、バーの下地だけを残す", async () => {
    mocks.listEvaluations.mockResolvedValue([completedEvaluation()]);

    render(<HomePage />);

    await screen.findByText("フィラーの数");
    const row = fillerRow();
    expect(row).toHaveTextContent("— / 計測対象外");
    expect(scoreBar(row)).toBeEmptyDOMElement();
  });

  it("本番モードと練習モードを固定する2つの開始導線を表示する", async () => {
    mocks.listEvaluations.mockResolvedValue([]);

    render(<HomePage />);

    expect(
      await screen.findByRole("link", { name: "本番モードを始める" }),
    ).toHaveAttribute("href", "/practice/setup?mode=interview");
    expect(
      screen.getByRole("link", { name: "練習モードを始める" }),
    ).toHaveAttribute("href", "/practice/setup?mode=practice");
  });
});
