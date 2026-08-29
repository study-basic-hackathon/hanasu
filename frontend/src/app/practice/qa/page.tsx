import { Card } from "@/components/ui/Card";
import {
  PracticeFinishLink,
  PracticeSubLayout,
} from "@/components/practice/PracticeSubLayout";
import { Button } from "@/components/ui/Button";

/** S-13 練習 - 一問一答評価（モック） */
export default function QaPracticePage() {
  return (
    <PracticeSubLayout screenId="S-13" name="一問一答評価">
      <Card className="flex flex-col gap-2 p-6">
        <span className="text-note text-ink-muted">質問</span>
        <span className="text-[17px] leading-[1.7] font-medium">
          なぜ当社を志望されたのですか。
        </span>
      </Card>
      <Card className="flex flex-1 flex-col gap-3 p-5">
        {/* モックのため切り替えは動かさず、文字入力を選んだ状態で見せる */}
        <div className="flex self-start overflow-hidden rounded-control border border-line-strong">
          <span className="grid h-[30px] place-items-center px-3.5 text-label text-ink-label">
            音声入力
          </span>
          <span className="grid h-[30px] place-items-center bg-accent px-3.5 text-label font-medium text-white">
            文字入力
          </span>
        </div>
        <div className="flex-1 rounded-control border border-line-strong p-3 text-label text-ink-muted">
          回答を入力してください
        </div>
      </Card>
      <div className="flex justify-end gap-2.5">
        <PracticeFinishLink />
        {/* 「回答する」を押しても何も起きない（S-09〜S-13 8章） */}
        <Button size="xs" className="text-label">
          回答する
        </Button>
      </div>
    </PracticeSubLayout>
  );
}
