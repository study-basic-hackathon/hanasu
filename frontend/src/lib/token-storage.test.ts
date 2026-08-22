import { beforeEach, describe, expect, it } from "vitest";

import {
  clearAccessToken,
  getAccessToken,
  storeAccessToken,
} from "@/lib/token-storage";

describe("token-storage", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it("アクセストークンを sessionStorage に保持して取得する", () => {
    storeAccessToken("jwt-token");

    expect(getAccessToken()).toBe("jwt-token");
    expect(window.localStorage).toHaveLength(0);
  });

  it("保持したアクセストークンを破棄する", () => {
    storeAccessToken("jwt-token");

    clearAccessToken();

    expect(getAccessToken()).toBeNull();
  });
});
