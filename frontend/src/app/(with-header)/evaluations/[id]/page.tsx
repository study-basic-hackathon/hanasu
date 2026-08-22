import { notFound } from "next/navigation";

import { MOCK_EVALUATIONS } from "@/mocks/evaluations";

import { EvaluationView } from "./_components/EvaluationView";

/**
 * S-14 評価 - 合否判定。
 * 履歴（S-16）や S-04 から開いたときも同じ画面を使う。
 * ポーリングは API 連携のときに入れるため、モックはダミーデータの状態をそのまま表示する。
 */
export default async function EvaluationPage(
  props: PageProps<"/evaluations/[id]">,
) {
  const { id } = await props.params;
  const { from } = await props.searchParams;
  const evaluation = MOCK_EVALUATIONS.find(
    (candidate) => String(candidate.evaluation_id) === id,
  );

  if (!evaluation) notFound();

  return (
    <EvaluationView
      evaluation={evaluation}
      fromInterview={from === "interview"}
    />
  );
}
