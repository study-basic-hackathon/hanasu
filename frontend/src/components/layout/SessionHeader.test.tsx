import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SessionHeader } from "@/components/layout/SessionHeader";

describe("SessionHeader", () => {
  afterEach(() => cleanup());

  it("ロゴを押すとホームへ遷移する", () => {
    render(<SessionHeader title="本番モード" />);

    expect(screen.getByRole("link", { name: "hanasu" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("compact 版でもロゴをホームへのリンクとして表示する", () => {
    render(<SessionHeader compact title="S-10 音読評価" />);

    expect(screen.getByRole("link", { name: "hanasu" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
