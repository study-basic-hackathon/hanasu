"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/cn";

/**
 * ナビ4項目（共通仕様 4.1）。
 * S-07（/companies/...）は「応募先企業」、S-14（/evaluations/detail）は「履歴」を現在地とする。
 * 練習モード（S-09）へはナビから直接入れない。
 */
const NAV_ITEMS = [
  { label: "ホーム", href: "/" },
  { label: "応募先企業", href: "/companies" },
  { label: "履歴", href: "/evaluations" },
  { label: "練習の設定", href: "/practice/setup" },
] as const;

function isCurrent(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * グローバルヘッダー（共通仕様 4章）。
 * S-04 / S-05 / S-06 / S-07 / S-14 / S-16 が持ち、スクロールしても位置を保つ。
 */
export function GlobalHeader() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-20 flex h-header flex-none items-center justify-between border-b border-line bg-surface px-8">
      <div className="flex items-center gap-9 self-stretch">
        <Link
          href="/"
          className="flex items-center text-[18px] font-bold tracking-[0.1em]"
        >
          hanasu
        </Link>
        <nav className="flex items-center gap-[26px] self-stretch text-body-sm">
          {NAV_ITEMS.map((item) => {
            const current = isCurrent(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex h-full items-center",
                  current
                    ? "font-medium text-accent shadow-[inset_0_-2px_0_var(--color-accent)]"
                    : "text-ink-sub hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-3.5 text-label text-ink-sub">
        <span>{user?.username}</span>
        <button
          type="button"
          onClick={signOut}
          className="rounded-control border border-line-strong px-[11px] py-1.5 text-label text-ink hover:bg-canvas"
        >
          サインアウト
        </button>
      </div>
    </header>
  );
}
