import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requestAccessToken } from "@/lib/auth-api";

describe("requestAccessToken", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8000/");
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("フォーム形式で認証 API を呼びアクセストークンを返す", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ access_token: "jwt-token", token_type: "bearer" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(requestAccessToken("user+1", "pass&word")).resolves.toEqual({
      ok: true,
      accessToken: "jwt-token",
    });
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8000/token");
    expect(options).toMatchObject({
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    expect(options?.body).toBeInstanceOf(URLSearchParams);
    expect((options?.body as URLSearchParams).toString()).toBe(
      "username=user%2B1&password=pass%26word",
    );
  });

  it.each([400, 401])("HTTP %i を認証失敗として返す", async (status) => {
    fetchMock.mockResolvedValue(new Response(null, { status }));

    await expect(requestAccessToken("user", "wrong")).resolves.toEqual({
      ok: false,
      reason: "invalid-credentials",
    });
  });

  it("サーバーエラーを通信・サーバーエラーとして返す", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));

    await expect(requestAccessToken("user", "password")).resolves.toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("通信失敗を画面で扱える結果へ正規化する", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(requestAccessToken("user", "password")).resolves.toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("仕様と異なる成功レスポンスを利用不能として返す", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ token_type: "bearer" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(requestAccessToken("user", "password")).resolves.toEqual({
      ok: false,
      reason: "unavailable",
    });
  });
});
