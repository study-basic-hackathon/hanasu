import { Card } from "@/components/ui/Card";
import {
  PracticeFinishLink,
  PracticeSubLayout,
  RecordSample,
  WaveSample,
} from "@/components/practice/PracticeSubLayout";

/** 録音中の見本として置く波形の高さ */
const WAVE = [10, 22, 14, 28, 18, 24, 12, 20, 8, 5];

/** S-11 練習 - 滑舌練習（モック） */
export default function ArticulationPracticePage() {
  return (
    <PracticeSubLayout screenId="S-11" name="滑舌練習">
      <Card className="flex flex-1 flex-col items-center justify-center gap-3.5">
        <span className="text-note text-ink-muted">課題フレーズ 2 / 5</span>
        <span className="text-[28px] font-bold tracking-[0.08em]">
          東京特許許可局
        </span>
        <span className="text-label text-ink-sub">
          3 回続けて読み上げてください
        </span>
      </Card>
      <div className="flex items-center gap-4">
        <RecordSample recording />
        <WaveSample heights={WAVE} />
        <PracticeFinishLink />
      </div>
    </PracticeSubLayout>
  );
}
