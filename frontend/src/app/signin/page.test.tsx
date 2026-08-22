import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SignInPage from "@/app/signin/page";
import type { RequestAccessTokenResult } from "@/lib/auth-api";
import { getAccessToken } from "@/lib/token-storage";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  requestAccessToken: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/lib/auth-api", () => ({
  requestAccessToken: mocks.requestAccessToken,
}));

function enterCredentials(userId = "hanasu", password = "password") {
  fireEvent.change(screen.getByLabelText("ID"), { target: { value: userId } });
  fireEvent.change(screen.getByLabelText("パスワード"), {
    target: { value: password },
  });
}

describe("SignInPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("資格情報が揃うまで送信できない", () => {
    render(<SignInPage />);

    const submitButton = screen.getByRole("button", { name: "サインイン" });
    expect(submitButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("ID"), {
      target: { value: "hanasu" },
    });
    expect(submitButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "password" },
    });
    expect(submitButton).toBeEnabled();
  });

  it("送信中の二重送信を防ぎ、成功時にトークンを保持してホームへ遷移する", async () => {
    let resolveRequest!: (result: RequestAccessTokenResult) => void;
    mocks.requestAccessToken.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );
    render(<SignInPage />);
    enterCredentials();

    fireEvent.click(screen.getByRole("button", { name: "サインイン" }));

    const pendingButton = screen.getByRole("button", {
      name: "サインインしています",
    });
    expect(pendingButton).toBeDisabled();
    expect(screen.getByLabelText("ID")).toBeDisabled();
    expect(screen.getByLabelText("パスワード")).toBeDisabled();

    const form = pendingButton.closest("form");
    if (!form) throw new Error("sign-in form is not rendered");
    fireEvent.submit(form);
    expect(mocks.requestAccessToken).toHaveBeenCalledOnce();

    resolveRequest({ ok: true, accessToken: "jwt-token" });

    await waitFor(() => {
      expect(getAccessToken()).toBe("jwt-token");
      expect(mocks.push).toHaveBeenCalledWith("/");
    });
  });

  it("認証失敗時は ID を残してパスワードだけ消す", async () => {
    mocks.requestAccessToken.mockResolvedValue({
      ok: false,
      reason: "invalid-credentials",
    });
    render(<SignInPage />);
    enterCredentials("hanasu", "wrong-password");

    fireEvent.click(screen.getByRole("button", { name: "サインイン" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ID またはパスワードが違います。",
    );
    expect(screen.getByLabelText("ID")).toHaveValue("hanasu");
    expect(screen.getByLabelText("パスワード")).toHaveValue("");
    expect(getAccessToken()).toBeNull();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("通信・サーバーエラー時は資格情報を残して再試行できる", async () => {
    mocks.requestAccessToken.mockResolvedValue({
      ok: false,
      reason: "unavailable",
    });
    render(<SignInPage />);
    enterCredentials("hanasu", "password");

    fireEvent.click(screen.getByRole("button", { name: "サインイン" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "サインインできませんでした。時間をおいてもう一度お試しください。",
    );
    expect(screen.getByLabelText("ID")).toHaveValue("hanasu");
    expect(screen.getByLabelText("パスワード")).toHaveValue("password");
    expect(screen.getByRole("button", { name: "サインイン" })).toBeEnabled();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
