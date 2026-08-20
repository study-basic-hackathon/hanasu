import { InterviewScreen } from "@/components/interview/InterviewScreen";

/**
 * S-03 チュートリアル。
 * S-08 の画面を流用し、質問を1問に固定して応募企業情報を使わない（画面一覧 3章）。
 */
export default function TutorialPage() {
  return <InterviewScreen mode="tutorial" />;
}
