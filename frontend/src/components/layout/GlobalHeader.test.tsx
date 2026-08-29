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

  it("グローバルヘッダーは3項目のナビゲーションを持つ", () => {
    render(<GlobalHeader />);

    const navigation = screen.getByRole("navigation");
    expect(within(navigation).getAllByRole("link")).toHaveLength(3);
    expect(
      within(navigation).getByRole("link", { name: "ホーム" }),
    ).toHaveAttribute("href", "/");
    expect(
      within(navigation).getByRole("link", { name: "ホーム" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(navigation).getByRole("link", { name: "応募先企業" }),
    ).toHaveAttribute("href", "/companies");
    expect(
      within(navigation).getByRole("link", { name: "履歴" }),
    ).toHaveAttribute("href", "/evaluations");
  });
});
