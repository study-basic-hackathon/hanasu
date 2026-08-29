import { Suspense } from "react";

import { InterviewRoute } from "@/components/interview/InterviewRoute";

/**
 * S-03 チュートリアル（文字入力）。
 * S-08 の画面を流用し、質問を1問に固定して応募企業情報を使わない（画面一覧 3章）。
 */
export default function TextTutorialPage() {
  return (
    <Suspense fallback={<p className="p-8 text-body-sm text-ink-sub">チュートリアルを準備しています。</p>}>
      <InterviewRoute mode="tutorial" answerMethod="text" />
    </Suspense>
  );
}
