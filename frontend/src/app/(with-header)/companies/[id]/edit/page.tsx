import { notFound } from "next/navigation";

import { MOCK_APPLICATIONS } from "@/mocks/applications";

import { ApplicationForm } from "../../_components/ApplicationForm";
import { resolveReturnTo } from "../../_components/returnTo";

/** S-07 応募企業情報 編集 */
export default async function EditCompanyPage(
  props: PageProps<"/companies/[id]/edit">,
) {
  const { id } = await props.params;
  const { from } = await props.searchParams;
  const application = MOCK_APPLICATIONS.find(
    (candidate) => String(candidate.id) === id,
  );

  if (!application) notFound();

  return (
    <ApplicationForm
      application={application}
      returnTo={resolveReturnTo(from)}
    />
  );
}
