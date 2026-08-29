import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SpeedPracticePage from "@/app/practice/speed/page";

describe("SpeedPracticePage", () => {
  it("100点となる話速の範囲を表示する", () => {
    render(<SpeedPracticePage />);

    expect(screen.getByText(/適正域（240〜260/)).toBeInTheDocument();
  });
});
