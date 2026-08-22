import { ApplicationForm } from "../_components/ApplicationForm";
import { resolveReturnTo } from "../_components/returnTo";

/** S-07 応募企業情報 新規登録 */
export default async function NewCompanyPage(
  props: PageProps<"/companies/new">,
) {
  const { from } = await props.searchParams;

  return <ApplicationForm returnTo={resolveReturnTo(from)} />;
}
