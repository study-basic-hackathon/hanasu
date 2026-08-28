import { PracticeSubLayout } from "@/components/practice/PracticeSubLayout";
import { ReadingPracticeSession } from "@/components/practice/ReadingPracticeSession";

const READING_PASSAGE =
  "私は前職で、社内の申請フローを見直す業務改善プロジェクトに携わりました。紙で回っていた承認を電子化し、平均で三日かかっていた決裁を半日に短縮しました。";

/** S-10 練習 - 音読評価 */
export default function ReadingPracticePage() {
  return (
    <PracticeSubLayout screenId="S-10" name="音読評価">
      <ReadingPracticeSession passage={READING_PASSAGE} />
    </PracticeSubLayout>
  );
}
