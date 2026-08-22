import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button, buttonClassName } from "@/components/ui/Button";

describe("Button", () => {
  it("既定の button 種別と見た目でクリック操作を渡す", () => {
    const onClick = vi.fn();

    render(<Button onClick={onClick}>保存する</Button>);

    const button = screen.getByRole("button", { name: "保存する" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("bg-accent", "h-btn");

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("指定したバリエーション・サイズ・追加クラスを反映する", () => {
    expect(buttonClassName("danger", "xs", "w-full")).toContain("border-danger");
    expect(buttonClassName("danger", "xs", "w-full")).toContain("h-9");
    expect(buttonClassName("danger", "xs", "w-full")).toContain("w-full");
  });
});
