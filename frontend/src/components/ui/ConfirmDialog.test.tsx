import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

describe("ConfirmDialog", () => {
  it("開いたときに確認・取消の操作を提供する", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open
        message="この企業情報を削除しますか？"
        confirmLabel="削除する"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    const dialog = screen.getByText("この企業情報を削除しますか？").closest("dialog");
    expect(dialog).toHaveAttribute("open");

    fireEvent.click(screen.getByRole("button", { name: "削除する" }));
    fireEvent.click(screen.getByRole("button", { name: "取り消す" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("Esc と close prop を取り消しとダイアログの閉鎖に反映する", () => {
    const onCancel = vi.fn();
    const { rerender } = render(
      <ConfirmDialog
        open
        message="面接を終了しますか？"
        confirmLabel="終了する"
        onConfirm={() => undefined}
        onCancel={onCancel}
      />,
    );
    const dialog = screen.getByText("面接を終了しますか？").closest("dialog");
    if (!dialog) throw new Error("dialog is not rendered");

    const cancelEvent = new Event("cancel", { cancelable: true });
    dialog.dispatchEvent(cancelEvent);
    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(onCancel).toHaveBeenCalledOnce();

    rerender(
      <ConfirmDialog
        open={false}
        message="面接を終了しますか？"
        confirmLabel="終了する"
        onConfirm={() => undefined}
        onCancel={onCancel}
      />,
    );
    expect(dialog).not.toHaveAttribute("open");
  });

  it("busy のあいだは両方のボタンを押せなくし、確定のラベルを替える（共通仕様 7.1）", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    // このファイルは cleanup を呼ばず前のレンダーが body に残る。
    // render の返すクエリは body に紐づくため、container に限定して引く
    const view = render(
      <ConfirmDialog
        open
        busy
        message="この結果を削除しますか？"
        confirmLabel="削除する"
        busyLabel="削除しています"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    const confirm = within(view.container).getByRole("button", { name: "削除しています" });
    const cancel = within(view.container).getByRole("button", { name: "取り消す" });
    expect(confirm).toBeDisabled();
    expect(cancel).toBeDisabled();

    fireEvent.click(confirm);
    fireEvent.click(cancel);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();

    // busy のあいだは Esc でも閉じない
    const dialog = within(view.container).getByText("この結果を削除しますか？").closest("dialog");
    if (!dialog) throw new Error("dialog is not rendered");
    dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    expect(onCancel).not.toHaveBeenCalled();
  });
});
