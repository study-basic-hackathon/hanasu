import { notFound } from "next/navigation";
import { Suspense } from "react";

import { MOCK_APPLICATIONS } from "@/mocks/applications";

import {
  ApplicationForm,
  ReturnAwareApplicationForm,
} from "../../_components/ApplicationForm";

export const dynamicParams = false;

export function generateStaticParams() {
  return MOCK_APPLICATIONS.map(({ id }) => ({ id: String(id) }));
}

/** S-07 応募企業情報 編集 */
export default async function EditCompanyPage(
  props: PageProps<"/companies/[id]/edit">,
) {
  const { id } = await props.params;
  const application = MOCK_APPLICATIONS.find(
    (candidate) => String(candidate.id) === id,
  );

  if (!application) notFound();

  return (
    <Suspense
      fallback={
        <ApplicationForm application={application} returnTo="/companies" />
      }
    >
      <ReturnAwareApplicationForm application={application} />
    </Suspense>
  );
}
