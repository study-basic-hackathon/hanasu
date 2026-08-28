import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createCompany,
  deleteCompany,
  listCompanies,
} from "@/lib/company-api";
import { storeAccessToken } from "@/lib/token-storage";

describe("company-api", () => {
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

  it("応募企業一覧を取得する", async () => {
    const companies = [{ id: 1, company_name: "株式会社テスト" }];
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(companies), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(listCompanies()).resolves.toEqual(companies);
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:8000/companies");
  });

  it("登録 API に現在のバックエンド契約どおりの JSON を送る", async () => {
    const input = {
      company_name: "株式会社テスト",
      motivation: "志望動機",
      resume: "経歴",
      company_url: "https://example.com/jobs/1",
      note: null,
      job_summary: "募集要項の要約",
    };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: 1, ...input }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await createCompany(input);

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual(input);
    expect(new Headers(init?.headers).get("Content-Type")).toBe(
      "application/json",
    );
  });

  it("削除 API の 204 を本文なしで扱う", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(deleteCompany(7)).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://localhost:8000/companies/7",
    );
    expect(fetchMock.mock.calls[0][1]?.method).toBe("DELETE");
  });
});
