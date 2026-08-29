import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EvaluationView } from "@/app/(with-header)/evaluations/_components/EvaluationView";
import type { Evaluation, QuantitativeScore } from "@/lib/domain";

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

function fillerCard(): HTMLElement {
  const card = screen.getByText("フィラーの数").parentElement;
  if (!card) throw new Error("フィラーのカードが見つかりません。");
  return card;
}

function scoreBar(container: HTMLElement): HTMLElement {
  const bar = container.querySelector<HTMLElement>(".bg-track");
  if (!bar) throw new Error("スコアバーが見つかりません。");
  return bar;
}

describe("EvaluationView のフィラー表示", () => {
  afterEach(() => cleanup());

  it("合計回数を出さず、小数第1位の毎分値だけを表示する", () => {
    render(
      <EvaluationView
        evaluation={completedEvaluation({
          score: 64,
          value: 2,
          unit: "回",
          value_per_minute: 9,
        })}
        fromInterview={false}
      />,
    );

    const card = fillerCard();
    expect(within(card).getByText("9.0 回/分")).toBeVisible();
    expect(within(card).queryByText("2 回")).not.toBeInTheDocument();
    expect(card).toHaveTextContent("64 点");
    expect(within(card).getByText("64")).toHaveClass("text-warning");
    expect(scoreBar(card).firstElementChild).toHaveClass("bg-warning");
    expect(scoreBar(card).firstElementChild).toHaveStyle({ width: "64%" });
  });

  it("点数を単位付きで出し、実測値とは別の要素に分ける", () => {
    render(
      <EvaluationView
        evaluation={completedEvaluation()}
        fromInterview={false}
      />,
    );

    const card = screen.getByText("話の速さ").parentElement;
    if (!card) throw new Error("話の速さのカードが見つかりません。");
    expect(card).toHaveTextContent("72 点");
    expect(within(card).getByText("284 文字/分")).toBeVisible();
  });

  it("構成・内容は点数の書式を揃え、実測値の代わりに AI 評価と出す", () => {
    render(
      <EvaluationView
        evaluation={completedEvaluation()}
        fromInterview={false}
      />,
    );

    const card = screen.getByText("構成・内容").parentElement;
    if (!card) throw new Error("構成・内容のカードが見つかりません。");
    expect(card).toHaveTextContent("75 点");
    expect(within(card).getByText("AI 評価")).toBeVisible();
  });

  it("計測できない場合はスコアと実測値を表示せず、バーの下地だけを残す", () => {
    render(
      <EvaluationView
        evaluation={completedEvaluation()}
        fromInterview={false}
      />,
    );

    const card = fillerCard();
    expect(within(card).getByText("—")).toBeVisible();
    expect(within(card).getByText("計測対象外")).toBeVisible();
    expect(
      within(card).getByText("計測できる音声回答がありません。"),
    ).toBeVisible();
    expect(scoreBar(card)).toBeEmptyDOMElement();
  });

  it("再挑戦では本番モードを固定した設定画面へ戻る", () => {
    render(
      <EvaluationView
        evaluation={completedEvaluation()}
        fromInterview={false}
      />,
    );

    expect(screen.getByRole("link", { name: "再挑戦する" })).toHaveAttribute(
      "href",
      "/practice/setup?mode=interview",
    );
  });
});
