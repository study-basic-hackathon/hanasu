import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/**
 * ボタンの見た目（共通仕様 11.3 / デザイン原本）。
 * - primary: アクセント色で塗る主要な操作
 * - secondary: 枠線だけの副次の操作
 * - outline: アクセント色の枠線（「試してみる」など）
 * - danger: 危険な操作の枠線（「面接を終える」）
 * - dangerSolid: 危険な操作の確定（「削除する」）
 * - onAccent: アクセント色のカードや濃色のカードの上に置く操作
 */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "danger"
  | "dangerSolid"
  | "onAccent";

/** md は主要なボタン（44px）、sm / xs は副次のボタン（40px / 36px） */
export type ButtonSize = "md" | "sm" | "xs";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "bg-accent font-medium text-white hover:bg-accent/90",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-canvas",
  outline: "border border-accent font-medium text-accent hover:bg-accent-soft",
  danger: "border border-danger text-danger hover:bg-danger/5",
  dangerSolid: "bg-danger font-medium text-white hover:bg-danger/90",
  onAccent: "bg-surface font-medium text-accent hover:bg-surface/90",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  md: "h-btn px-5 text-body",
  sm: "h-btn-sm px-4 text-body-sm",
  xs: "h-9 px-4 text-body-sm",
};

/** ボタンと同じ見た目を Link などに与えるためのクラス名 */
export function buttonClassName(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(
    "inline-flex items-center justify-center rounded-control whitespace-nowrap transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-50",
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    className,
  );
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClassName(variant, size, className)}
      {...props}
    />
  );
}
