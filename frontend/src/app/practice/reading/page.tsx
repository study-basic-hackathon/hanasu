import { Card } from "@/components/ui/Card";
import {
  PracticeFinishLink,
  PracticeSubLayout,
  RecordSample,
} from "@/components/practice/PracticeSubLayout";

/** S-10 練習 - 音読評価（モック） */
export default function ReadingPracticePage() {
  return (
    <PracticeSubLayout screenId="S-10" name="音読評価">
      <Card className="flex-1 p-6 text-card leading-[2.2]">
        私は前職で、社内の申請フローを見直す業務改善プロジェクトに携わりました。紙で回っていた承認を電子化し、平均で三日かかっていた決裁を半日に短縮しました。
      </Card>
      <div className="flex items-center gap-4">
        <RecordSample />
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="h-[5px] rounded-chip bg-track">
            <div className="h-[5px] w-0 rounded-chip bg-accent" />
          </div>
          <span className="text-note text-ink-muted">
            タップで録音を開始します（00:00 / 01:00）
          </span>
        </div>
        <PracticeFinishLink />
      </div>
    </PracticeSubLayout>
  );
}
