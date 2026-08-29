import { Suspense } from "react";

import { AnswerMethodRedirect } from "@/components/interview/AnswerMethodRedirect";

/** 回答方式を分ける前の URL。`/interview/voice`・`/interview/text` へ送る */
export default function InterviewPage() {
  return (
    <Suspense fallback={<p className="p-8 text-body-sm text-ink-sub">面接を準備しています。</p>}>
      <AnswerMethodRedirect mode="interview" />
    </Suspense>
  );
}
