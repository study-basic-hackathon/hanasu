import { QaPracticeSession } from "@/components/practice/QaPracticeSession";
import { PracticeSubLayout } from "@/components/practice/PracticeSubLayout";

const QA_QUESTION = "なぜ当社を志望されたのですか。";

/** S-13 練習 - 一問一答評価 */
export default function QaPracticePage() {
  return (
    <PracticeSubLayout screenId="S-13" name="一問一答評価">
      <QaPracticeSession question={QA_QUESTION} />
    </PracticeSubLayout>
  );
}
