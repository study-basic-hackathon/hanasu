import Link from "next/link";

import { SessionHeader } from "@/components/layout/SessionHeader";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";

/** サブ機能のメニュー（S-09 3章） */
const PRACTICE_ITEMS = [
  {
    screenId: "S-10",
    name: "音読評価",
    description: "提示された文章を読み上げ、話し方を評価します。",
    href: "/practice/reading",
  },
  {
    screenId: "S-11",
    name: "滑舌練習",
    description: "発音しにくい語句を読み上げます。",
    href: "/practice/articulation",
  },
  {
    screenId: "S-12",
    name: "スピード測定",
    description: "話す速さを測り、適正な速度との差を知ります。",
    href: "/practice/speed",
  },
  {
    screenId: "S-13",
    name: "一問一答評価",
    description: "志望動機など単一の質問に答え、内容を評価します。",
    href: "/practice/qa",
  },
];

/**
 * S-09 練習モード。弱点ごとの個別トレーニングの入口。
 * ハッカソンでは画面のモックだけを作り、評価は行わない（画面一覧 3章）。
 */
export default function PracticeMenuPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SessionHeader
        title={
          <>
            練習モード
            <Chip tone="muted" className="text-[10px]">
              画面モック
            </Chip>
          </>
        }
        right={
          <Link
            href="/practice/setup"
            className="text-label text-accent hover:underline"
          >
            設定に戻る
          </Link>
        }
      />
      <div className="py-9">
        <div className="mx-auto flex w-[1080px] flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-heading font-bold">練習メニュー</h1>
            <p className="text-label text-ink-sub">
              弱点ごとの個別トレーニングです。この画面はモックで、評価は行われません。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-5">
            {PRACTICE_ITEMS.map((item) => (
              <Link key={item.screenId} href={item.href}>
                <Card className="flex h-full flex-col gap-2.5 p-6 hover:border-accent">
                  <span className="text-note text-ink-muted">
                    {item.screenId}
                  </span>
                  <span className="text-card font-bold">{item.name}</span>
                  <span className="text-label leading-[1.8] text-ink-sub">
                    {item.description}
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
