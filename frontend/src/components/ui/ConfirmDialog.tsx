"use client";

import { type ReactNode, useEffect, useRef } from "react";

import { Button, type ButtonVariant } from "@/components/ui/Button";

type ConfirmDialogProps = {
  open: boolean;
  /** 確認の文面または詳細 */
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** 確定のボタンの見た目 */
  confirmVariant?: ButtonVariant;
  /** 確定の処理中。両方のボタンを押せなくし、確定のラベルを busyLabel に替える（共通仕様 7.1） */
  busy?: boolean;
  /** busy のあいだ確定のボタンに出す文言。省略時は confirmLabel のまま */
  busyLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * 確認（S-05 の開始、S-06 の削除、S-08 の面接終了）。
 * フォーカスの閉じ込めと Esc を自前で書かずに済むよう、ブラウザの dialog を使う。
 */
export function ConfirmDialog({
  open,
  message,
  confirmLabel,
  cancelLabel = "取り消す",
  confirmVariant = "dangerSolid",
  busy = false,
  busyLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      // Esc も「取り消す」と同じ扱いにする。処理中は閉じさせない
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-auto rounded-card border border-line bg-surface p-0 text-ink backdrop:bg-black/30"
    >
      <div className="flex w-[420px] flex-col gap-5 p-7">
        <div className="text-body-sm leading-[1.9]">{message}</div>
        <div className="flex justify-end gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={confirmVariant}
            size="sm"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? (busyLabel ?? confirmLabel) : confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
