import { Suspense } from "react";

import { AnswerMethodRedirect } from "@/components/interview/AnswerMethodRedirect";

/** 回答方式を分ける前の URL。`/tutorial/voice`・`/tutorial/text` へ送る */
export default function TutorialPage() {
  return (
    <Suspense fallback={<p className="p-8 text-body-sm text-ink-sub">チュートリアルを準備しています。</p>}>
      <AnswerMethodRedirect mode="tutorial" />
    </Suspense>
  );
}
