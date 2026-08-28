import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApplicationForm } from "@/app/(with-header)/companies/_components/ApplicationForm";
import type { Company } from "@/lib/company-api";

const mocks = vi.hoisted(() => ({
  createCompany: vi.fn(),
  push: vi.fn(),
  updateCompany: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/lib/company-api", () => ({
  createCompany: mocks.createCompany,
  updateCompany: mocks.updateCompany,
}));

const company: Company = {
  id: 7,
  company_name: "株式会社テスト",
  company_url: "https://example.com/jobs/7",
  motivation: "志望動機",
  resume: "経歴・実績",
  note: "備考",
  job_summary: "保存済みの募集要項の要約",
  created_at: "2026-08-28T00:00:00Z",
};

describe("ApplicationForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    mocks.createCompany.mockResolvedValue(company);
    mocks.updateCompany.mockResolvedValue(company);
  });

  afterEach(() => cleanup());

  it("6項目だけを表示し、編集時に募集要項の要約を復元する", () => {
    render(<ApplicationForm company={company} returnTo="/companies" />);

    expect(screen.getByRole("textbox", { name: /企業名/ })).toHaveValue(
      company.company_name,
    );
    expect(screen.getByRole("textbox", { name: "募集要項 URL" })).toHaveValue(
      company.company_url,
    );
    expect(screen.getByRole("textbox", { name: /志望動機/ })).toHaveValue(
      company.motivation,
    );
    expect(screen.getByRole("textbox", { name: "経歴・実績" })).toHaveValue(
      company.resume,
    );
    expect(screen.getByRole("textbox", { name: "備考" })).toHaveValue(
      company.note,
    );
    expect(
      screen.getByRole("textbox", { name: "募集要項の要約" }),
    ).toHaveValue(company.job_summary);
    expect(screen.getByText("4 / 4")).toBeVisible();

    for (const removedLabel of [
      "職種",
      "応募書類（貼り付け）",
      "現職 / 直近の所属",
      "経験年数",
    ]) {
      expect(screen.queryByLabelText(removedLabel)).not.toBeInTheDocument();
    }
    expect(
      screen.queryByRole("button", { name: "募集要項の要約" }),
    ).not.toBeInTheDocument();
  });

  it("必須、URL形式、全項目の最大長エラーを入力欄の近くに表示する", () => {
    const { container } = render(
      <ApplicationForm returnTo="/companies" />,
    );
    const form = container.querySelector("form");
    expect(form).not.toBeNull();

    fireEvent.submit(form!);
    expect(screen.getByText("企業名を入力してください。")).toBeVisible();
    expect(screen.getByText("志望動機を入力してください。")).toBeVisible();

    const fields = [
      ["企業名", 100],
      ["募集要項 URL", 2_048],
      ["志望動機", 4_000],
      ["経歴・実績", 10_000],
      ["備考", 2_000],
      ["募集要項の要約", 4_000],
    ] as const;

    fireEvent.change(screen.getByRole("textbox", { name: /企業名/ }), {
      target: { value: "株式会社テスト" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /志望動機/ }), {
      target: { value: "志望動機" },
    });

    for (const [label, maximum] of fields) {
      const input = screen.getByRole("textbox", {
        name: new RegExp(label),
      });
      fireEvent.change(input, { target: { value: "あ".repeat(maximum + 1) } });
      fireEvent.submit(form!);
      expect(
        screen.getByText(
          `${label}は${maximum.toLocaleString()}文字以内で入力してください。`,
        ),
      ).toBeVisible();
      fireEvent.change(input, {
        target: {
          value:
            label === "企業名"
              ? "株式会社テスト"
              : label === "志望動機"
                ? "志望動機"
                : "",
        },
      });
    }

    const urlInput = screen.getByRole("textbox", { name: "募集要項 URL" });
    fireEvent.change(urlInput, { target: { value: "ftp://example.com/jobs" } });
    fireEvent.submit(form!);
    expect(
      screen.getByText(
        "http:// または https:// で始まる URL を入力してください。",
      ),
    ).toBeVisible();
    expect(mocks.createCompany).not.toHaveBeenCalled();
  });

  it("6項目を前後空白を除いて登録し、呼び出し元へ戻る", async () => {
    render(<ApplicationForm returnTo="/practice/setup" />);

    const values = {
      company_name: "  株式会社テスト  ",
      company_url: "  https://example.com/jobs/7  ",
      motivation: "  志望動機  ",
      resume: "  経歴・実績  ",
      note: "  備考  ",
      job_summary: "  募集要項の要約  ",
    };
    for (const [name, value] of Object.entries(values)) {
      fireEvent.change(document.querySelector(`[name="${name}"]`)!, {
        target: { value },
      });
    }
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));

    await waitFor(() =>
      expect(mocks.createCompany).toHaveBeenCalledWith({
        company_name: "株式会社テスト",
        company_url: "https://example.com/jobs/7",
        motivation: "志望動機",
        resume: "経歴・実績",
        note: "備考",
        job_summary: "募集要項の要約",
      }),
    );
    expect(mocks.push).toHaveBeenCalledWith("/practice/setup");
  });

  it("募集要項の要約を手編集して更新する", async () => {
    render(<ApplicationForm company={company} returnTo="/companies" />);

    fireEvent.change(
      screen.getByRole("textbox", { name: "募集要項の要約" }),
      { target: { value: "編集後の募集要項の要約" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));

    await waitFor(() =>
      expect(mocks.updateCompany).toHaveBeenCalledWith(
        company.id,
        expect.objectContaining({ job_summary: "編集後の募集要項の要約" }),
      ),
    );
  });
});
