import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** コンテンツの最大幅は画面ごとに 880〜1200px（共通仕様 3章） */
export type ContentWidth = 880 | 960 | 1000 | 1080 | 1200;

const WIDTH_CLASS: Record<ContentWidth, string> = {
  880: "w-[880px]",
  960: "w-[960px]",
  1000: "w-[1000px]",
  1080: "w-[1080px]",
  1200: "w-[1200px]",
};

type PageContainerProps = {
  width: ContentWidth;
  className?: string;
  children: ReactNode;
};

/** 中央寄せのコンテンツ領域。上下余白は 32px（共通仕様 3章） */
export function PageContainer({
  width,
  className,
  children,
}: PageContainerProps) {
  return (
    <div className="py-8">
      <div className={cn("mx-auto", WIDTH_CLASS[width], className)}>
        {children}
      </div>
    </div>
  );
}
