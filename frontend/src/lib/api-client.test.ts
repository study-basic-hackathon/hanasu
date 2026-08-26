import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  apiRequest,
  AUTH_REQUIRED_EVENT,
} from "@/lib/api-client";
import {
  getAccessToken,
  storeAccessToken,
} from "@/lib/token-storage";

describe("apiRequest", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    window.sessionStorage.clear();
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8000/");
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("API base URL と Bearer トークンを付けて JSON を返す", async () => {
    storeAccessToken("jwt-token");
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: 1, username: "hanasu" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(apiRequest("/users/me")).resolves.toEqual({
      id: 1,
      username: "hanasu",
    });

    const [url, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(url).toBe("http://localhost:8000/users/me");
    expect(headers.get("Authorization")).toBe("Bearer jwt-token");
    expect(headers.get("Accept")).toBe("application/json");
  });

  it("トークンがなければ通信せず認証要求を通知する", async () => {
    const listener = vi.fn();
    window.addEventListener(AUTH_REQUIRED_EVENT, listener);

    await expect(apiRequest("/companies")).rejects.toMatchObject({
      status: 401,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalledOnce();

    window.removeEventListener(AUTH_REQUIRED_EVENT, listener);
  });

  it("HTTP 401 ならトークンを破棄して認証要求を通知する", async () => {
    storeAccessToken("expired-token");
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    const listener = vi.fn();
    window.addEventListener(AUTH_REQUIRED_EVENT, listener);

    await expect(apiRequest("/companies")).rejects.toMatchObject({
      status: 401,
    });
    expect(getAccessToken()).toBeNull();
    expect(listener).toHaveBeenCalledOnce();

    window.removeEventListener(AUTH_REQUIRED_EVENT, listener);
  });

  it("JSON のエラー詳細を ApiError に保持する", async () => {
    storeAccessToken("jwt-token");
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: "企業情報が見つかりません" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(apiRequest("/companies/999")).rejects.toMatchObject({
      status: 404,
      detail: { detail: "企業情報が見つかりません" },
    });
  });
});
