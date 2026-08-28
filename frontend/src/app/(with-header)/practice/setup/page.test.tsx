import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PracticeSetupPage from "@/app/(with-header)/practice/setup/page";

const mocks = vi.hoisted(() => ({
  listCompanies: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
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
  created_at: "2026-08-28T00:00:00Z",
};

describe("PracticeSetupPage の読み上げモード", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      screen.getByRole("button", { name: "読み上げモード: 読み上げない" }),
    ).toHaveAttribute("aria-pressed", "true");
    await selectCompany();
    fireEvent.click(screen.getByRole("button", { name: "開始する" }));

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
    fireEvent.click(screen.getByRole("button", { name: "開始する" }));

    expect(mocks.push).toHaveBeenCalledWith(
      "/interview?companyId=7&strength=standard&answerMethod=voice&readAloud=enabled&maxTurns=10",
    );
  });
});
