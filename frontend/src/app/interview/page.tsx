import { Suspense } from "react";

import { InterviewScreen } from "@/components/interview/InterviewScreen";

/** S-08 本番モード。グローバルヘッダーを持たず、専用ヘッダーを使う */
export default function InterviewPage() {
  return (
    <Suspense fallback={<p className="p-8 text-body-sm text-ink-sub">面接を準備しています。</p>}>
      <InterviewScreen mode="interview" />
    </Suspense>
  );
}
