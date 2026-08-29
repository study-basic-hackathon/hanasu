import { Suspense } from "react";

import { InterviewRoute } from "@/components/interview/InterviewRoute";

/** S-08 本番モード（音声入力）。グローバルヘッダーを持たず、専用ヘッダーを使う */
export default function VoiceInterviewPage() {
  return (
    <Suspense fallback={<p className="p-8 text-body-sm text-ink-sub">面接を準備しています。</p>}>
      <InterviewRoute mode="interview" answerMethod="voice" />
    </Suspense>
  );
}
