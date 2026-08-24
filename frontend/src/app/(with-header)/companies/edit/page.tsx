import { Suspense } from "react";

import { CompanyEditPage } from "../_components/CompanyEditPage";

export default function EditCompanyRoute() {
  return (
    <Suspense fallback={<p className="p-8 text-body-sm text-ink-sub">応募企業情報を読み込んでいます。</p>}>
      <CompanyEditPage />
    </Suspense>
  );
}
