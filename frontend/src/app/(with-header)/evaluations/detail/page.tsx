import { Suspense } from "react";

import { EvaluationDetailPage } from "../_components/EvaluationDetailPage";

export default function EvaluationDetailRoute() {
  return (
    <Suspense fallback={<p className="p-8 text-body-sm text-ink-sub">評価結果を読み込んでいます。</p>}>
      <EvaluationDetailPage />
    </Suspense>
  );
}
