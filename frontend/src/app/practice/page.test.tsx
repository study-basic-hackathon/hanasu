import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PracticeMenuPage from "@/app/practice/page";

describe("PracticeMenuPage", () => {
  it("実施する3つの練習だけを表示する", () => {
    render(<PracticeMenuPage />);

    expect(screen.getByRole("link", { name: /音読評価/ })).toHaveAttribute(
      "href",
      "/practice/reading",
    );
    expect(screen.getByRole("link", { name: /スピード測定/ })).toHaveAttribute(
      "href",
      "/practice/speed",
    );
    expect(screen.getByRole("link", { name: /一問一答評価/ })).toHaveAttribute(
      "href",
      "/practice/qa",
    );
    expect(screen.queryByText("滑舌練習")).not.toBeInTheDocument();
    expect(screen.queryByText("画面モック")).not.toBeInTheDocument();
  });
});
