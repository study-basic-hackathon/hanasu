import { fireEvent, render, screen } from "@testing-library/react";
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
});
