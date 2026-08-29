"use client";

import type { InterviewMode } from "@/components/interview/InterviewScreen";
import { InterviewScreen } from "@/components/interview/InterviewScreen";
import { TextAnswerPanel } from "@/components/interview/TextAnswerPanel";
import { VoiceAnswerPanel } from "@/components/interview/VoiceAnswerPanel";
import type { AnswerMethod } from "@/lib/domain";

export function basePathOf(mode: InterviewMode): string {
  return mode === "tutorial" ? "/tutorial" : "/interview";
}

/** 回答方式ごとのページの URL。設定はクエリ文字列のまま持ち回る */
export function answerMethodPath(
  mode: InterviewMode,
  answerMethod: AnswerMethod,
  query: string,
): string {
  const path = `${basePathOf(mode)}/${answerMethod}`;
  return query === "" ? path : `${path}?${query}`;
}

/** 回答方式ごとのページ（`/interview/voice` など）が共有する入口。 */
export function InterviewRoute({
  mode,
  answerMethod,
}: {
  mode: InterviewMode;
  answerMethod: AnswerMethod;
}) {
  return (
    <InterviewScreen
      mode={mode}
      answerMethod={answerMethod}
      InputPanel={answerMethod === "voice" ? VoiceAnswerPanel : TextAnswerPanel}
    />
  );
}
