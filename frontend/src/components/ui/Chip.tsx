import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/** チップ・バッジの色味 */
export type ChipTone = "neutral" | "muted" | "accent" | "warning" | "danger";

const TONE_CLASS: Record<ChipTone, string> = {
  neutral: "border border-line-strong bg-surface text-ink-sub",
  muted: "bg-[#eef1f3] text-ink-label",
  accent: "border border-accent bg-accent-soft text-accent",
  warning: "border border-warning bg-surface text-warning",
  danger: "border border-danger bg-surface text-danger",
};

type ChipProps = ComponentProps<"span"> & {
  tone?: ChipTone;
};

/** チップ・バッジ（共通仕様 11.3: 角丸 3px） */
export function Chip({ tone = "neutral", className, ...props }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-chip px-2 py-0.5 text-note",
        TONE_CLASS[tone],
        className,
      )}
      {...props}
    />
  );
}
