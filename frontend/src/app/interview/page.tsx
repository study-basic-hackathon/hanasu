import { InterviewScreen } from "@/components/interview/InterviewScreen";

/** S-08 本番モード。グローバルヘッダーを持たず、専用ヘッダーを使う */
export default function InterviewPage() {
  return <InterviewScreen mode="interview" />;
}
