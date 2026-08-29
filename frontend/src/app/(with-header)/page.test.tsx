import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "@/app/(with-header)/page";
import type { Evaluation, QuantitativeScore } from "@/lib/domain";

const mocks = vi.hoisted(() => ({
  listCompanies: vi.fn(),
  listEvaluations: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
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

function scoreRow(label: string): HTMLElement {
  const row = screen.getByText(label).parentElement?.parentElement;
  if (!row) throw new Error(`${label} の行が見つかりません。`);
  return row;
}

describe("HomePage の項目別スコアの表記", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listCompanies.mockResolvedValue([]);
  });

  afterEach(() => cleanup());

  it("点数を単位付きで出し、実測値とは別の要素に分ける", async () => {
    mocks.listEvaluations.mockResolvedValue([completedEvaluation()]);

    render(<HomePage />);

    await screen.findByText("話の速さ");
    const row = scoreRow("話の速さ");
    expect(row).toHaveTextContent("72 点");
    expect(within(row).getByText("284 文字/分")).toBeVisible();
    expect(within(row).getByText("284 文字/分")).toHaveClass("text-ink-muted");
  });

  it("構成・内容は点数の書式を揃え、実測値を持たないことを示す", async () => {
    mocks.listEvaluations.mockResolvedValue([completedEvaluation()]);

    render(<HomePage />);

    await screen.findByText("構成・内容");
    const row = scoreRow("構成・内容");
    expect(row).toHaveTextContent("75 点");
    expect(within(row).getByText("AI 評価")).toBeVisible();
  });
});

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
    expect(row).toHaveTextContent("64 点");
    expect(row).toHaveTextContent("9.0 回/分");
    expect(row).not.toHaveTextContent("2 回");
    expect(row.firstElementChild?.lastElementChild?.firstElementChild).toHaveClass(
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
    expect(row).toHaveTextContent("—");
    expect(row).toHaveTextContent("計測対象外");
    expect(row).not.toHaveTextContent("点");
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

  it("チュートリアルは方式を確認してから音声入力のページへ進む", async () => {
    mocks.listEvaluations.mockResolvedValue([]);

    render(<HomePage />);
    fireEvent.click(await screen.findByRole("button", { name: "試してみる" }));

    // ホームには選択の手掛かりがないため、音声入力・読み上げるが初期値になる
    expect(
      screen.getByRole("button", { name: "回答方式: 音声入力" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "読み上げモード: 読み上げる" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(mocks.push).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "チュートリアルを始める" }),
    );

    expect(mocks.push).toHaveBeenCalledExactlyOnceWith(
      "/tutorial/voice?readAloud=enabled",
    );
  });

  it("チュートリアルの確認で文字入力と読み上げないを選んで進める", async () => {
    mocks.listEvaluations.mockResolvedValue([]);

    render(<HomePage />);
    fireEvent.click(await screen.findByRole("button", { name: "試してみる" }));
    fireEvent.click(screen.getByRole("button", { name: "回答方式: 文字入力" }));
    fireEvent.click(
      screen.getByRole("button", { name: "読み上げモード: 読み上げない" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "チュートリアルを始める" }),
    );

    expect(mocks.push).toHaveBeenCalledExactlyOnceWith(
      "/tutorial/text?readAloud=disabled",
    );
    // 遷移の途中で初期値へ戻ったように見せない
    expect(
      screen.getByRole("button", { name: "回答方式: 文字入力" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "読み上げモード: 読み上げない" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("チュートリアルの確認を取り消すと遷移せず、選択も持ち越さない", async () => {
    mocks.listEvaluations.mockResolvedValue([]);

    render(<HomePage />);
    fireEvent.click(await screen.findByRole("button", { name: "試してみる" }));
    fireEvent.click(screen.getByRole("button", { name: "回答方式: 文字入力" }));
    fireEvent.click(screen.getByRole("button", { name: "取り消す" }));

    expect(mocks.push).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "試してみる" }));

    expect(
      screen.getByRole("button", { name: "回答方式: 音声入力" }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});
