import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/** カード（白い面）。画面の基本単位（共通仕様 3章） */
export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-card border border-line bg-surface", className)}
      {...props}
    />
  );
}
