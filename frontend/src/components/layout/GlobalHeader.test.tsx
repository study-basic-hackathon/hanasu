import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GlobalHeader } from "@/components/layout/GlobalHeader";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("@/components/auth/AuthProvider", () => ({
  useAuth: () => ({
    user: { username: "test-user" },
    signOut: vi.fn(),
  }),
}));

describe("GlobalHeader", () => {
  afterEach(() => cleanup());

  it("モード未確定の設定導線はホームを開き、開始をホームに集約する", () => {
    render(<GlobalHeader />);

    const navigation = screen.getByRole("navigation");
    expect(within(navigation).getAllByRole("link")).toHaveLength(4);
    expect(
      within(navigation).getByRole("link", { name: "練習の設定" }),
    ).toHaveAttribute("href", "/");
    expect(
      within(navigation).getByRole("link", { name: "練習の設定" }),
    ).not.toHaveAttribute("aria-current");
    expect(
      within(navigation).getByRole("link", { name: "ホーム" }),
    ).toHaveAttribute("href", "/");
  });
});
