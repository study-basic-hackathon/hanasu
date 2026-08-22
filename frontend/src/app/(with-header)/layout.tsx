import { GlobalHeader } from "@/components/layout/GlobalHeader";

/**
 * グローバルヘッダーを持つ画面（S-04 / S-05 / S-06 / S-07 / S-14 / S-16）の骨格。
 * S-01 と、専用ヘッダーを持つ S-08 / S-09〜S-13 はこのレイアウトの外に置く（共通仕様 4章・5章）。
 */
export default function WithHeaderLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <GlobalHeader />
      <main className="flex-1">{children}</main>
    </>
  );
}
