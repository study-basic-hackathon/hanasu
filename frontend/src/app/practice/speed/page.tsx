import { SpeedPracticeSession } from "@/components/practice/SpeedPracticeSession";
import { PracticeSubLayout } from "@/components/practice/PracticeSubLayout";

const SPEED_PASSAGE =
  "前職では、開発チームの進行管理を担当し、週次の見通しを関係者に共有していました。";

/** S-12 練習 - スピード測定 */
export default function SpeedPracticePage() {
  return (
    <PracticeSubLayout screenId="S-12" name="スピード測定">
      <SpeedPracticeSession passage={SPEED_PASSAGE} />
    </PracticeSubLayout>
  );
}
