import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TextArea, TextField } from "@/components/ui/TextField";

describe("TextField", () => {
  it("ラベル、必須表示、単位、入力値を関連付けて表示する", () => {
    render(
      <TextField label="経験年数" required suffix="年" defaultValue="3" />,
    );

    const input = screen.getByRole("textbox", { name: "経験年数必須" });
    expect(input).toHaveValue("3");
    expect(input).toHaveClass("pr-9", "border-line-strong");
    expect(screen.getByText("年")).toBeInTheDocument();
  });

  it("エラー時はヒントの代わりにエラーとアクセシビリティ属性を出す", () => {
    render(
      <TextField
        label="企業名"
        error="企業名を入力してください"
        hint="正式名称を入力してください"
      />,
    );

    const input = screen.getByRole("textbox", { name: "企業名" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveClass("border-danger");
    expect(input).toHaveAccessibleDescription("企業名を入力してください");
    expect(screen.queryByText("正式名称を入力してください")).not.toBeInTheDocument();
  });

  it("textarea にも共通のラベル・ヒント・入力を渡す", () => {
    render(<TextArea label="備考" hint="任意です" />);

    const textarea = screen.getByRole("textbox", { name: "備考" });
    fireEvent.change(textarea, { target: { value: "補足" } });
    expect(textarea).toHaveValue("補足");
    expect(textarea).toHaveAccessibleDescription("任意です");
  });
});
