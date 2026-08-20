"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AnswerPanel } from "@/components/interview/AnswerPanel";
import { ChatMessage } from "@/components/interview/ChatMessage";
import { SessionHeader } from "@/components/layout/SessionHeader";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/cn";
import {
  countFillers,
  MAX_TURNS,
  TUTORIAL_MAX_TURNS,
  TUTORIAL_QUESTION,
} from "@/lib/interview";
import { MOCK_APPLICATIONS } from "@/mocks/applications";
import type { ChatTurn } from "@/mocks/conversation";
import {
  MOCK_INTERVIEW_TURNS,
  MOCK_NEXT_QUESTIONS,
} from "@/mocks/conversation";
import { MOCK_PENDING_EVALUATION_ID } from "@/mocks/evaluations";
import type { AnswerMethod, QuestionStrength } from "@/mocks/types";
import { ANSWER_METHOD_LABEL, QUESTION_STRENGTH_LABEL } from "@/mocks/types";

/** S-08 本番モードと、それを流用する S-03 チュートリアル（S-08 9章） */
export type InterviewMode = "interview" | "tutorial";

/** 実施条件は S-05 から引き渡される。モックでは見本の値を置く */
const MOCK_COMPANY_NAME = MOCK_APPLICATIONS[0]?.company_name ?? "";
const MOCK_QUESTION_STRENGTH: QuestionStrength = "standard";

function nowClock(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function InterviewScreen({ mode }: { mode: InterviewMode }) {
  const router = useRouter();
  const isTutorial = mode === "tutorial";
  const maxTurns = isTutorial ? TUTORIAL_MAX_TURNS : MAX_TURNS;

  const [turns, setTurns] = useState<ChatTurn[]>(() =>
    isTutorial
      ? [{ role: "assistant", content: TUTORIAL_QUESTION }]
      : MOCK_INTERVIEW_TURNS,
  );
  const [answerMethod, setAnswerMethod] = useState<AnswerMethod>("voice");
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const answeredTurns = turns.filter((turn) => turn.role === "user").length;
  // 回答を送るまでは、いま答えようとしているターンの番号（S-08 4章）
  const currentTurn = Math.min(answeredTurns + 1, maxTurns);
  const canEnd = answeredTurns > 0;

  // 新しい発言が増えたら、その発言が見えるところまで送る（S-08 5章）
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: "end" });
  }, [turns]);

  // 再読み込み・タブを閉じる操作には確認を出す（共通仕様 7.3）
  useEffect(() => {
    if (answeredTurns === 0) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [answeredTurns]);

  /** 評価を実行して S-14 へ移る。待ち合わせは S-14 が行う（S-08 7章） */
  function goToEvaluation() {
    router.push(`/evaluations/${MOCK_PENDING_EVALUATION_ID}`);
  }

  function handleSubmit(
    content: string,
    detail?: { audioSeconds: number; fillerCount: number },
  ) {
    const answer: ChatTurn = {
      role: "user",
      content,
      time: nowClock(),
      audio_seconds: detail?.audioSeconds,
      filler_count: detail?.fillerCount ?? countFillers(content),
    };
    const answered = answeredTurns + 1;

    // 上限に達したら確認を出さずに評価へ進む（S-08 4章 / 9章）
    if (answered >= maxTurns) {
      setTurns((current) => [...current, answer]);
      goToEvaluation();
      return;
    }

    // モックでは POST /interviews/chat を呼ばず、見本の質問を順に出す
    const nextQuestion =
      MOCK_NEXT_QUESTIONS[(answered - 1) % MOCK_NEXT_QUESTIONS.length];
    setTurns((current) => [
      ...current,
      answer,
      { role: "assistant", content: nextQuestion, time: nowClock() },
    ]);
  }

  return (
    <div className="flex h-dvh flex-col">
      <SessionHeader
        title={isTutorial ? "チュートリアル" : "本番モード"}
        right={
          <div className="flex items-center gap-3">
            {/* 回答が1つもない状態では押せない（S-08 7章） */}
            {!canEnd && (
              <span className="text-note text-ink-muted">
                1問以上答えると評価できます。
              </span>
            )}
            <Button
              variant="danger"
              size="xs"
              disabled={!canEnd}
              onClick={() => setConfirmingEnd(true)}
              className="font-medium"
            >
              面接を終える
            </Button>
          </div>
        }
      />

      {/* 実施条件の帯（S-08 3章） */}
      <div className="flex h-13 flex-none items-center justify-between border-b border-line bg-surface px-8">
        <div className="flex items-center gap-2.5">
          {isTutorial ? (
            <Chip tone="accent" className="px-2.5 py-[5px] text-label font-medium">
              チュートリアル
            </Chip>
          ) : (
            <>
              <Chip
                tone="accent"
                className="px-2.5 py-[5px] text-label font-medium"
              >
                {MOCK_COMPANY_NAME}
              </Chip>
              <Chip tone="muted" className="px-2.5 py-[5px] text-label">
                質問の強度：{QUESTION_STRENGTH_LABEL[MOCK_QUESTION_STRENGTH]}
              </Chip>
            </>
          )}
          <Chip tone="muted" className="px-2.5 py-[5px] text-label">
            回答方式：{ANSWER_METHOD_LABEL[answerMethod]}
          </Chip>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-label text-ink-sub">
            ターン {currentTurn} / {maxTurns}
          </span>
          <div className="flex gap-1">
            {Array.from({ length: maxTurns }, (_, index) => (
              <span
                key={index}
                className={cn(
                  "block h-[5px] w-[26px] rounded-[2px]",
                  index < answeredTurns ? "bg-accent" : "bg-[#dde1e4]",
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 会話ログ。ここだけがスクロールする */}
      <div className="flex-1 overflow-y-auto py-8">
        <div className="mx-auto flex w-[880px] flex-col gap-[22px]">
          {turns.map((turn, index) => (
            <ChatMessage key={index} turn={turn} />
          ))}
          <div ref={logEndRef} />
        </div>
      </div>

      <div className="flex-none border-t border-line bg-surface pt-5 pb-6">
        <div className="mx-auto flex w-[880px] flex-col gap-3.5">
          <AnswerPanel
            answerMethod={answerMethod}
            onChangeAnswerMethod={setAnswerMethod}
            onSubmit={handleSubmit}
          />
          <p className="text-note text-ink-muted">
            この画面を離れると会話は失われます。評価は「面接を終える」を押したあとに行われます。
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={confirmingEnd}
        message="評価に進みます。この会話には戻れません。"
        confirmLabel="評価に進む"
        confirmVariant="primary"
        onConfirm={goToEvaluation}
        onCancel={() => setConfirmingEnd(false)}
      />
    </div>
  );
}
