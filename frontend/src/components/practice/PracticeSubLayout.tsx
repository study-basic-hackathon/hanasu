import Link from "next/link";
import type { ReactNode } from "react";

import { SessionHeader } from "@/components/layout/SessionHeader";
import { cn } from "@/lib/cn";

type PracticeSubLayoutProps = {
  /** 画面 ID（例: `S-10`） */
  screenId: string;
  name: string;
  children: ReactNode;
};

/**
 * S-10〜S-13 に共通する骨格（S-09〜S-13 4章）。
 * 上部に 48px の帯（ロゴ + 画面 ID + 画面名）を置き、中身は幅 708px の枠に収める。
 */
export function PracticeSubLayout({
  screenId,
  name,
  children,
}: PracticeSubLayoutProps) {
  return (
    <div className="flex flex-col">
      <SessionHeader
        compact
        title={`${screenId} ${name}`}
        right={
          <Link
            href="/practice"
            className="text-label text-accent hover:underline"
          >
            別の練習を選ぶ
          </Link>
        }
      />
      {/* 原本の枠（708 × 420px）に合わせ、中身が少なくても高さを保つ */}
      <div className="mx-auto flex min-h-[320px] w-[708px] flex-col gap-[18px] p-7">
        {children}
      </div>
    </div>
  );
}

/** 各サブ機能の下部に置く「終える」（→ S-09） */
export function PracticeFinishLink() {
  return (
    <Link
      href="/practice"
      className="flex h-9 flex-none items-center rounded-control border border-line-strong px-4 text-label hover:bg-canvas"
    >
      終える
    </Link>
  );
}

/** 録音の見本。モックでは録音を行わないため、押せる操作にはしない */
export function RecordSample({ recording }: { recording?: boolean }) {
  return (
    <span
      className={cn(
        "grid size-12 flex-none place-items-center rounded-full",
        recording ? "bg-danger shadow-[0_0_0_5px_#f7e6e5]" : "bg-accent",
      )}
    >
      <span
        className={cn(
          "block size-3.5 bg-white",
          recording ? "rounded-[3px]" : "rounded-full",
        )}
      />
    </span>
  );
}

/** 録音中の波形の見本 */
export function WaveSample({ heights }: { heights: number[] }) {
  return (
    <div className="flex h-[30px] flex-1 items-end gap-[3px]">
      {heights.map((height, index) => (
        <span
          key={index}
          className="block w-1 rounded-[2px] bg-accent"
          style={{ height: `${height}px` }}
        />
      ))}
    </div>
  );
}
