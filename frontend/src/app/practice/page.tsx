import Link from "next/link";

import { SessionHeader } from "@/components/layout/SessionHeader";
import { Card } from "@/components/ui/Card";

/** サブ機能のメニュー（S-09 3章） */
const PRACTICE_ITEMS = [
  {
    screenId: "S-10",
    name: "音読評価",
    description: "提示された文章を読み上げ、話し方を評価します。",
    href: "/practice/reading",
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
    description: "志望動機など単一の質問に答え、話し方を確認します。",
    href: "/practice/qa",
  },
];

/**
 * S-09 練習モード。弱点ごとの個別トレーニングの入口。
 * 音読・スピード・一問一答の個別トレーニングを選ぶ。
 */
export default function PracticeMenuPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SessionHeader
        title="練習モード"
        right={
          <Link href="/" className="text-label text-accent hover:underline">
            ホームへ戻る
          </Link>
        }
      />
      <div className="py-9">
        <div className="mx-auto flex w-[1080px] flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-heading font-bold">練習メニュー</h1>
            <p className="text-label text-ink-sub">
              弱点ごとの個別トレーニングです。取り組む練習を選んでください。
            </p>
          </div>
          <div className="grid grid-cols-3 gap-5">
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
