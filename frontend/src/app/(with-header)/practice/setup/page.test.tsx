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

  it("既定値を読み上げないとして面接画面へ渡す", async () => {
    render(<PracticeSetupPage />);

    expect(
      screen.getByRole("heading", { name: "本番モードの設定" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "練習モード" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "読み上げモード: 読み上げない" }),
    ).toHaveAttribute("aria-pressed", "true");
    await selectCompany();
    fireEvent.click(
      screen.getByRole("button", { name: "本番モードを始める" }),
    );

    expect(mocks.push).toHaveBeenCalledWith(
      "/interview?companyId=7&strength=standard&answerMethod=voice&readAloud=disabled&maxTurns=10",
    );
  });

  it("読み上げるを選ぶと選択値を面接画面へ渡す", async () => {
    render(<PracticeSetupPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "読み上げモード: 読み上げる" }),
    );
    await selectCompany();
    fireEvent.click(
      screen.getByRole("button", { name: "本番モードを始める" }),
    );

    expect(mocks.push).toHaveBeenCalledWith(
      "/interview?companyId=7&strength=standard&answerMethod=voice&readAloud=enabled&maxTurns=10",
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
