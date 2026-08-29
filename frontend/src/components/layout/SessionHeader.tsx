import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type SessionHeaderProps = {
  /** ロゴの右に出す画面名 */
  title: ReactNode;
  /** S-10〜S-13 の 48px 版 */
  compact?: boolean;
  /** 右端に置く離脱の導線 */
  right?: ReactNode;
};

/**
 * 専用ヘッダー（共通仕様 5章）。
 * S-08 / S-09 / S-10〜S-13 はグローバルヘッダーを持たず、離脱の導線だけを残す。
 * ロゴはグローバルヘッダーと同様に押すとホーム（S-04）へ遷移する。
 */
export function SessionHeader({ title, compact, right }: SessionHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-none items-center justify-between border-b border-line bg-surface px-8",
        compact ? "h-12" : "h-header",
      )}
    >
      <div className="flex items-center gap-5">
        <Link
          href="/"
          className="flex items-center text-[18px] font-bold tracking-[0.1em]"
        >
          hanasu
        </Link>
        <span
          className={cn(
            "flex items-center gap-2 text-body-sm",
            compact ? "font-medium text-ink" : "text-ink-sub",
          )}
        >
          {title}
        </span>
      </div>
      {right}
    </header>
  );
}
