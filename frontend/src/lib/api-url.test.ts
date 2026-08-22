import { afterEach, describe, expect, it, vi } from "vitest";

import { getApiBaseUrl } from "@/lib/api-url";

describe("getApiBaseUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    {
      configuredUrl: "http://localhost:8000",
      expectedUrl: "http://localhost:8000",
    },
    {
      configuredUrl: "  http://localhost:8000///  ",
      expectedUrl: "http://localhost:8000",
    },
    {
      configuredUrl: "https://d111111abcdef8.cloudfront.net/",
      expectedUrl: "https://d111111abcdef8.cloudfront.net",
    },
  ])(
    "$configuredUrl を $expectedUrl に正規化する",
    ({ configuredUrl, expectedUrl }) => {
      vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", configuredUrl);

      expect(getApiBaseUrl()).toBe(expectedUrl);
    },
  );

  it.each([undefined, "", "   "])(
    "未設定または空の場合は明示的なエラーにする: %s",
    (configuredUrl) => {
      vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", configuredUrl);

      expect(() => getApiBaseUrl()).toThrowError(
        "NEXT_PUBLIC_API_BASE_URL が未設定です。",
      );
    },
  );
});
