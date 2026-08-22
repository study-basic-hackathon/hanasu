"use client";

import { useEffect, useRef } from "react";

import { Button, type ButtonVariant } from "@/components/ui/Button";

type ConfirmDialogProps = {
  open: boolean;
  /** 確認の文面 */
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** 確定のボタンの見た目 */
  confirmVariant?: ButtonVariant;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * 確認（S-06 の削除、S-08 の面接終了）。
 * フォーカスの閉じ込めと Esc を自前で書かずに済むよう、ブラウザの dialog を使う。
 */
export function ConfirmDialog({
  open,
  message,
  confirmLabel,
  cancelLabel = "取り消す",
  confirmVariant = "dangerSolid",
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
      // Esc も「取り消す」と同じ扱いにする
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="m-auto rounded-card border border-line bg-surface p-0 text-ink backdrop:bg-black/30"
    >
      <div className="flex w-[420px] flex-col gap-5 p-7">
        <p className="text-body-sm leading-[1.9]">{message}</p>
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
