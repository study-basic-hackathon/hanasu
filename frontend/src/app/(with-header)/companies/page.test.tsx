import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CompaniesPage from "@/app/(with-header)/companies/page";

const mocks = vi.hoisted(() => ({
  deleteCompany: vi.fn(),
  listCompanies: vi.fn(),
}));

vi.mock("@/lib/company-api", () => ({
  deleteCompany: mocks.deleteCompany,
  listCompanies: mocks.listCompanies,
}));

describe("CompaniesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listCompanies.mockResolvedValue([
      {
        id: 1,
        company_name: "要約だけの企業",
        company_url: null,
        motivation: null,
        resume: null,
        note: null,
        job_summary: "募集要項の要約",
        created_at: "2026-08-28T00:00:00Z",
      },
      {
        id: 2,
        company_name: "全項目の企業",
        company_url: "https://example.com/jobs/2",
        motivation: "志望動機",
        resume: "経歴・実績",
        note: "備考",
        job_summary: null,
        created_at: "2026-08-28T00:00:00Z",
      },
    ]);
  });

  afterEach(() => cleanup());

  it("職種を表示せず、6項目から登録済みの4区分を作る", async () => {
    render(<CompaniesPage />);

    expect(await screen.findByText("要約だけの企業")).toBeVisible();
    expect(screen.getByText("募集要項のみ")).toBeVisible();
    expect(
      screen.getByText("募集要項 / 志望動機 / 経歴 / 備考"),
    ).toBeVisible();
    expect(screen.getByText("企業名")).toBeVisible();
    expect(screen.queryByText(/企業名 \/ 職種/)).not.toBeInTheDocument();
  });
});
