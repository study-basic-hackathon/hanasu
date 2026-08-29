import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PracticeSetupPage from "@/app/(with-header)/practice/setup/page";

const mocks = vi.hoisted(() => ({
  listCompanies: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  searchParams: new URLSearchParams("mode=interview"),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  useSearchParams: () => mocks.searchParams,
}));

vi.mock("@/lib/company-api", () => ({
  listCompanies: mocks.listCompanies,
}));

const company = {
  id: 7,
  company_name: "株式会社テスト",
  motivation: null,
  resume: null,
  company_url: null,
  note: null,
  job_summary: null,
  created_at: "2026-08-28T00:00:00Z",
};

describe("PracticeSetupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.searchParams = new URLSearchParams("mode=interview");
    mocks.listCompanies.mockResolvedValue([company]);
  });

  afterEach(() => cleanup());

  async function selectCompany() {
    fireEvent.click(
      await screen.findByRole("button", { name: /株式会社テスト/ }),
    );
  }

  it("本番モードの設定を確認し、確定した場合だけ面接画面へ渡す", async () => {
    render(<PracticeSetupPage />);

    expect(
      screen.getByRole("heading", { name: "本番モードの設定" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "練習モード" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "読み上げモード: 読み上げる" }),
    ).toHaveAttribute("aria-pressed", "true");
    await selectCompany();
    fireEvent.click(
      screen.getByRole("button", { name: "本番モードを始める" }),
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("この設定で本番モードを開始しますか？");
    expect(dialog).toHaveTextContent("対象企業株式会社テスト");
    expect(dialog).toHaveTextContent("回答方式音声");
    expect(dialog).toHaveTextContent("質問の強度標準");
    expect(dialog).toHaveTextContent("最大ターン数10 ターン");
    expect(dialog).toHaveTextContent("読み上げモード読み上げる");
    expect(mocks.push).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "開始する" }));

    expect(mocks.push).toHaveBeenCalledWith(
      "/interview?companyId=7&strength=standard&answerMethod=voice&readAloud=enabled&maxTurns=10",
    );
  });

  it("確認を取り消しても選択済みの設定を保持し、再確認して開始できる", async () => {
    render(<PracticeSetupPage />);

    fireEvent.click(screen.getByRole("button", { name: "文字入力" }));
    fireEvent.click(screen.getByRole("button", { name: "厳しめ" }));
    fireEvent.click(
      screen.getByRole("button", { name: "読み上げモード: 読み上げる" }),
    );
    fireEvent.change(screen.getByRole("spinbutton", { name: "最大ターン数" }), {
      target: { value: "12" },
    });
    await selectCompany();
    fireEvent.click(
      screen.getByRole("button", { name: "本番モードを始める" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "取り消す" }));

    expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "文字入力" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "厳しめ" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "読み上げモード: 読み上げる" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("spinbutton", { name: "最大ターン数" })).toHaveValue(
      12,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "本番モードを始める" }),
    );
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "読み上げモード読み上げる",
    );
    fireEvent.click(screen.getByRole("button", { name: "開始する" }));

    expect(mocks.push).toHaveBeenCalledWith(
      "/interview?companyId=7&strength=hard&answerMethod=text&readAloud=enabled&maxTurns=12",
    );
  });

  it("カスタム選択時だけ自然言語を必須・500文字で検証し、保持して面接へ渡す", async () => {
    const instruction = "回答の根拠を数値で確認してください";
    const enteredInstruction = `  ${instruction}  `;
    render(<PracticeSetupPage />);

    expect(
      screen.queryByRole("textbox", { name: "カスタムの質問強度" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "カスタム" }));
    const input = screen.getByRole("textbox", {
      name: "カスタムの質問強度",
    });
    expect(input).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "カスタムの質問強度を入力してください。",
    );

    await selectCompany();
    expect(
      screen.getByRole("button", { name: "本番モードを始める" }),
    ).toBeDisabled();

    fireEvent.change(input, { target: { value: "指".repeat(501) } });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "カスタムの質問強度は500文字以内で入力してください。",
    );
    expect(screen.getByText("501/500文字")).toBeVisible();

    fireEvent.change(input, { target: { value: enteredInstruction } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText(`${instruction.length}/500文字`)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "本番モードを始める" }),
    ).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "標準" }));
    expect(
      screen.queryByRole("textbox", { name: "カスタムの質問強度" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "カスタム" }));
    expect(
      screen.getByRole("textbox", { name: "カスタムの質問強度" }),
    ).toHaveValue(enteredInstruction);

    fireEvent.click(
      screen.getByRole("button", { name: "本番モードを始める" }),
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("質問の強度カスタム");
    expect(dialog).toHaveTextContent(`カスタムの指示${instruction}`);
    fireEvent.click(screen.getByRole("button", { name: "開始する" }));

    const destination = new URL(
      String(mocks.push.mock.calls[0][0]),
      "http://localhost",
    );
    expect(destination.pathname).toBe("/interview");
    expect(destination.searchParams.get("strength")).toBe("custom");
    expect(destination.searchParams.get("customQuestionStrength")).toBe(
      instruction,
    );
  });

  it("募集要項の要約を登録済み情報として表示する", async () => {
    mocks.listCompanies.mockResolvedValue([
      { ...company, motivation: null, job_summary: "募集要項の要約" },
    ]);

    render(<PracticeSetupPage />);

    expect(await screen.findByText("募集要項")).toBeVisible();
    expect(screen.queryByText(/職種/)).not.toBeInTheDocument();
  });

  it("練習モードを固定し、既存の練習メニューへ進む", async () => {
    mocks.searchParams = new URLSearchParams("mode=practice");

    render(<PracticeSetupPage />);

    expect(
      screen.getByRole("heading", { name: "練習モードの設定" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "本番モード" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("spinbutton", { name: "最大ターン数" }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /株式会社テスト/ }),
    ).toBeDisabled();

    fireEvent.click(
      screen.getByRole("button", { name: "練習モードを始める" }),
    );

    expect(mocks.push).toHaveBeenCalledWith("/practice");
  });

  it("企業追加・編集の戻り先に固定されたモードを含める", async () => {
    render(<PracticeSetupPage />);

    expect(
      await screen.findByRole("link", { name: "企業を追加" }),
    ).toHaveAttribute(
      "href",
      "/companies/new?from=%2Fpractice%2Fsetup%3Fmode%3Dinterview",
    );
    expect(screen.getByRole("link", { name: "編集" })).toHaveAttribute(
      "href",
      "/companies/edit?id=7&from=%2Fpractice%2Fsetup%3Fmode%3Dinterview",
    );
  });

  it.each(["", "mode=invalid", "mode=interview&mode=practice"])(
    "モードを確定できないURL (%s) はホームへ戻す",
    async (query) => {
      mocks.searchParams = new URLSearchParams(query);

      render(<PracticeSetupPage />);

      await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/"));
      expect(mocks.listCompanies).not.toHaveBeenCalled();
    },
  );
});
