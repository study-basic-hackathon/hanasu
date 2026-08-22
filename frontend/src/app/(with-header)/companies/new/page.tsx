import { Suspense } from "react";

import {
  ApplicationForm,
  ReturnAwareApplicationForm,
} from "../_components/ApplicationForm";

/** S-07 応募企業情報 新規登録 */
export default function NewCompanyPage() {
  return (
    <Suspense fallback={<ApplicationForm returnTo="/companies" />}>
      <ReturnAwareApplicationForm />
    </Suspense>
  );
}
