import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SpeedPracticePage from "@/app/practice/speed/page";

describe("SpeedPracticePage", () => {
  it("課題文を表示してスピード測定を開始できる", () => {
    render(<SpeedPracticePage />);

    expect(screen.getByText(/前職では、開発チームの進行管理/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "スピード測定の録音を開始する" }),
    ).toBeEnabled();
  });
});
