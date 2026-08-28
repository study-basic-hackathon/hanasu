import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { summarizeJobPosting } from "@/lib/job-posting-api";
import { storeAccessToken } from "@/lib/token-storage";

describe("job-posting-api", () => {
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

  it("募集要項 URL を要約 API へ送り、要約文字列を返す", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ summary: "募集要項の要約" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      summarizeJobPosting("https://example.com/jobs/1"),
    ).resolves.toBe("募集要項の要約");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8000/job-postings/summary");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      company_url: "https://example.com/jobs/1",
    });
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      "Bearer jwt-token",
    );
  });
});
