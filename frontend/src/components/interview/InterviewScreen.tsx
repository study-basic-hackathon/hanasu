"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  ChatMessage,
  type SpeechStatus,
  ThinkingMessage,
} from "@/components/interview/ChatMessage";
import type {
  AnswerDetail,
  InterviewInputPanel,
} from "@/components/interview/InterviewInput";
import { SessionHeader } from "@/components/layout/SessionHeader";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/cn";
import { getCompany } from "@/lib/company-api";
import type {
  AnswerMethod,
  ChatTurn,
  QuestionStrength,
  ReadAloudMode,
  TranscriptDisplayMode,
} from "@/lib/domain";
import { createEvaluation } from "@/lib/evaluation-api";
import { buildEvaluationScores } from "@/lib/evaluation-score";
import { storeEvaluationSession } from "@/lib/evaluation-session";
import {
  ANSWER_METHOD_LABEL,
  CUSTOM_QUESTION_STRENGTH_MAX_LENGTH,
  QUESTION_STRENGTH_LABEL,
  READ_ALOUD_MODE_LABEL,
  TRANSCRIPT_DISPLAY_MODE_LABEL,
} from "@/lib/domain";
import {
  FIRST_QUESTION,
  resolveMaxTurns,
  resolveReadAloudMode,
  TUTORIAL_MAX_TURNS,
  TUTORIAL_QUESTION,
} from "@/lib/interview";
import { requestNextQuestion, synthesizeSpeech } from "@/lib/interview-api";

/** S-08 本番モードと、それを流用する S-03 チュートリアル（S-08 9章） */
export type InterviewMode = "interview" | "tutorial";

const READ_ALOUD_MODES: ReadAloudMode[] = ["enabled", "disabled"];
const TRANSCRIPT_DISPLAY_MODES: TranscriptDisplayMode[] = ["clean", "raw"];
const COMPLETION_TURN: ChatTurn = {
  role: "assistant",
  content: "お疲れ様でした",
};
const INTERVIEWER_SPEECH_PLAYBACK_RATE = 1.2;

type SpeechState = {
  turnIndex: number | null;
  status: SpeechStatus;
};

type ExitAction = "interrupt" | "home";

const IDLE_SPEECH_STATE: SpeechState = { turnIndex: null, status: "idle" };

function questionStrengthOf(value: string | null): QuestionStrength | null {
  return value === "easy" ||
    value === "standard" ||
    value === "hard" ||
    value === "custom"
    ? value
    : null;
}

function customQuestionStrengthOf(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  const length = Array.from(trimmed).length;
  return length >= 1 && length <= CUSTOM_QUESTION_STRENGTH_MAX_LENGTH
    ? trimmed
    : null;
}

function nowClock(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

type InterviewScreenProps = {
  mode: InterviewMode;
  /** 回答方式はページで決まる。画面の中では切り替えない */
  answerMethod: AnswerMethod;
  /** 回答方式ごとの入力エリア */
  InputPanel: InterviewInputPanel;
};

export function InterviewScreen({
  mode,
  answerMethod,
  InputPanel,
}: InterviewScreenProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isTutorial = mode === "tutorial";
  const maxTurns = isTutorial
    ? TUTORIAL_MAX_TURNS
    : resolveMaxTurns(searchParams.get("maxTurns"));
  const configuredCompanyId = Number(searchParams.get("companyId"));
  const companyId =
    !isTutorial && Number.isSafeInteger(configuredCompanyId) && configuredCompanyId > 0
      ? configuredCompanyId
      : null;
  const configuredQuestionStrength = questionStrengthOf(
    searchParams.get("strength"),
  );
  const configuredCustomQuestionStrength = customQuestionStrengthOf(
    searchParams.get("customQuestionStrength"),
  );
  const questionStrength =
    configuredQuestionStrength === "custom" &&
    configuredCustomQuestionStrength === null
      ? "standard"
      : (configuredQuestionStrength ?? "standard");
  const customQuestionStrength =
    questionStrength === "custom"
      ? (configuredCustomQuestionStrength ?? undefined)
      : undefined;
  const configuredReadAloudMode = resolveReadAloudMode(
    searchParams.get("readAloud"),
  );

  const [turns, setTurns] = useState<ChatTurn[]>(() =>
    isTutorial
      ? [{ role: "assistant", content: TUTORIAL_QUESTION }]
      : [{ role: "assistant", content: FIRST_QUESTION }],
  );
  const [readAloudMode, setReadAloudMode] = useState<ReadAloudMode>(
    configuredReadAloudMode,
  );
  const [transcriptDisplayMode, setTranscriptDisplayMode] =
    useState<TranscriptDisplayMode>(() => (isTutorial ? "clean" : "raw"));
  const [speechState, setSpeechState] = useState<SpeechState>(IDLE_SPEECH_STATE);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [exitAction, setExitAction] = useState<ExitAction | null>(null);
  const [exitStarted, setExitStarted] = useState(false);
  const [interviewController, setInterviewController] = useState(
    () => new AbortController(),
  );
  const [waiting, setWaiting] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const evaluationInFlightRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechObjectUrlRef = useRef<string | null>(null);
  const speechControllerRef = useRef<AbortController | null>(null);
  const speechOperationIdRef = useRef(0);
  const initialAutoSpeechStartedRef = useRef(false);
  const pendingAutoSpeechIndexRef = useRef<number | null>(null);
  const interviewControllerRef = useRef(interviewController);
  const chatControllerRef = useRef<AbortController | null>(null);
  const exitStartedRef = useRef(false);

  const releaseSpeech = useCallback(() => {
    speechControllerRef.current?.abort();
    speechControllerRef.current = null;

    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    if (speechObjectUrlRef.current) {
      URL.revokeObjectURL(speechObjectUrlRef.current);
      speechObjectUrlRef.current = null;
    }
  }, []);

  const stopSpeech = useCallback(() => {
    speechOperationIdRef.current += 1;
    releaseSpeech();
    setSpeechState(IDLE_SPEECH_STATE);
  }, [releaseSpeech]);

  const startSpeech = useCallback(
    async (turnIndex: number, text: string) => {
      const operationId = ++speechOperationIdRef.current;
      releaseSpeech();

      const controller = new AbortController();
      speechControllerRef.current = controller;
      setSpeechState({ turnIndex, status: "loading" });

      const fail = () => {
        if (operationId !== speechOperationIdRef.current) return;
        speechOperationIdRef.current += 1;
        releaseSpeech();
        setSpeechState({ turnIndex, status: "error" });
      };

      try {
        const blob = await synthesizeSpeech(text, controller.signal);
        if (
          operationId !== speechOperationIdRef.current ||
          controller.signal.aborted
        ) {
          return;
        }
        speechControllerRef.current = null;

        const objectUrl = URL.createObjectURL(blob);
        speechObjectUrlRef.current = objectUrl;
        audioRef.current ??= new Audio();
        audioRef.current.src = objectUrl;
        audioRef.current.playbackRate = INTERVIEWER_SPEECH_PLAYBACK_RATE;
        audioRef.current.onended = () => {
          if (operationId !== speechOperationIdRef.current) return;
          speechOperationIdRef.current += 1;
          releaseSpeech();
          setSpeechState(IDLE_SPEECH_STATE);
        };
        audioRef.current.onerror = fail;

        await audioRef.current.play();
        if (operationId !== speechOperationIdRef.current) return;
        setSpeechState({ turnIndex, status: "playing" });
      } catch {
        if (
          operationId !== speechOperationIdRef.current ||
          controller.signal.aborted
        ) {
          return;
        }
        fail();
      }
    },
    [releaseSpeech],
  );

  const toggleSpeech = useCallback(
    (turnIndex: number, text: string) => {
      if (
        speechState.turnIndex === turnIndex &&
        speechState.status === "playing"
      ) {
        stopSpeech();
        return;
      }
      void startSpeech(turnIndex, text);
    },
    [speechState, startSpeech, stopSpeech],
  );

  useEffect(() => {
    return () => {
      chatControllerRef.current?.abort();
      speechOperationIdRef.current += 1;
      releaseSpeech();
    };
  }, [releaseSpeech]);

  // 最初の質問だけは会話 API を経由しないため、ここで読み上げを始める
  useEffect(() => {
    if (
      configuredReadAloudMode !== "enabled" ||
      initialAutoSpeechStartedRef.current
    ) {
      return;
    }

    const firstQuestion = isTutorial ? TUTORIAL_QUESTION : FIRST_QUESTION;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled || initialAutoSpeechStartedRef.current) return;
      initialAutoSpeechStartedRef.current = true;
      void startSpeech(0, firstQuestion);
    });

    return () => {
      cancelled = true;
    };
  }, [configuredReadAloudMode, isTutorial, startSpeech]);

  /**
   * 新しい離脱導線で共有する終了処理。確認の確定後に一度だけ実行し、
   * 通信・録音・再生と画面内の一時会話データを破棄する。
   */
  const finishInterview = useCallback(() => {
    if (exitStartedRef.current) return false;
    exitStartedRef.current = true;
    setExitStarted(true);
    setExitAction(null);
    interviewControllerRef.current.abort();
    chatControllerRef.current?.abort();
    chatControllerRef.current = null;
    pendingAutoSpeechIndexRef.current = null;
    stopSpeech();
    setWaiting(false);
    setTurns([]);
    setApiError(null);
    return true;
  }, [stopSpeech]);

  useEffect(() => {
    if (isTutorial || companyId === null) return;
    const controller = new AbortController();
    getCompany(companyId, controller.signal)
      .then((company) => setCompanyName(company.company_name))
      .catch(() => {
        if (!controller.signal.aborted) {
          setApiError("対象企業の情報を取得できませんでした。設定画面から選び直してください。");
        }
      });
    return () => controller.abort();
  }, [companyId, isTutorial]);

  const answeredTurns = turns.filter((turn) => turn.role === "user").length;
  // 回答を送るまでは、いま答えようとしているターンの番号（S-08 4章）
  const currentTurn = Math.min(answeredTurns + 1, maxTurns);
  const canEnd = answeredTurns > 0;
  const hasReachedTurnLimit = answeredTurns >= maxTurns;

  // 新しい発言が増えたら、その発言が見えるところまで送る（S-08 5章）
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: "end" });
  }, [turns, waiting]);

  useEffect(() => {
    const turnIndex = pendingAutoSpeechIndexRef.current;
    if (turnIndex === null) return;
    pendingAutoSpeechIndexRef.current = null;
    const turn = turns[turnIndex];
    if (readAloudMode === "enabled" && turn?.role === "assistant") {
      void startSpeech(turnIndex, turn.content);
    }
  }, [readAloudMode, startSpeech, turns]);

  // 再読み込み・タブを閉じる操作には確認を出す（共通仕様 7.3）
  useEffect(() => {
    if (answeredTurns === 0) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [answeredTurns]);

  /**
   * 評価を実行して S-14 へ移る。待ち合わせは S-14 が行う（S-08 7章）。
   * `from=interview` は、失敗したときに「評価をやり直す」を出せる場合の目印
   */
  const goToEvaluation = useCallback(
    async (
      evaluationTurns: ChatTurn[] = turns,
      restoreInterruptedInterviewOnFailure = false,
    ) => {
      if (evaluationInFlightRef.current) return;
      evaluationInFlightRef.current = true;
      setConfirmingEnd(false);
      setEvaluating(true);
      setApiError(null);

      try {
        const input = {
          companyId,
          questionStrength: isTutorial ? null : questionStrength,
          answerMethod,
          turns: evaluationTurns,
          scores: buildEvaluationScores(evaluationTurns),
        };
        const evaluationId = await createEvaluation(input);
        storeEvaluationSession(evaluationId, {
          ...input,
          companyName,
        });
        router.push(
          `/evaluations/detail?id=${evaluationId}&from=interview`,
        );
      } catch {
        evaluationInFlightRef.current = false;
        if (restoreInterruptedInterviewOnFailure) {
          const restoredController = new AbortController();
          interviewControllerRef.current = restoredController;
          setInterviewController(restoredController);
          exitStartedRef.current = false;
          setExitStarted(false);
          setTurns(evaluationTurns);
        }
        setApiError(
          "評価を開始できませんでした。時間をおいてもう一度お試しください。",
        );
        setEvaluating(false);
      }
    }, [
      answerMethod,
      companyId,
      companyName,
      isTutorial,
      questionStrength,
      router,
      turns,
    ],
  );

  const handleSubmit = useCallback(
    (
      content: string,
      detail?: AnswerDetail,
    ) => {
      const answer: ChatTurn = {
        role: "user",
        content,
        time: nowClock(),
        ...(detail
          ? {
              raw_content: detail.rawContent,
              audio_seconds: detail.audioSeconds,
              audio_duration_ms: detail.audioDurationMs,
              character_count: detail.characterCount,
              filler_count: detail.fillerCount,
              filler_count_per_min: detail.fillerCountPerMin,
              chars_per_min: detail.charsPerMin,
            }
          : {}),
      };
      const nextTurns = [...turns, answer];
      setTurns(nextTurns);
      setApiError(null);

      // 上限到達後は会話を確認できる状態で止め、評価は利用者の操作を待つ。
      if (answeredTurns + 1 >= maxTurns) {
        return;
      }
      if (companyId === null) return;

      setWaiting(true);
      const chatController = new AbortController();
      chatControllerRef.current?.abort();
      chatControllerRef.current = chatController;
      requestNextQuestion(
        {
          companyId,
          questionStrength,
          customQuestionStrength,
          maxTurns,
          history: nextTurns,
        },
        chatController.signal,
      )
        .then((nextQuestion) => {
          if (chatController.signal.aborted || exitStartedRef.current) return;
          pendingAutoSpeechIndexRef.current = nextTurns.length;
          setTurns([
            ...nextTurns,
            { role: "assistant", content: nextQuestion, time: nowClock() },
          ]);
          setWaiting(false);
        })
        .catch(() => {
          if (chatController.signal.aborted || exitStartedRef.current) return;
          setWaiting(false);
          setApiError("次の質問を取得できませんでした。回答をもう一度送信してください。");
        })
        .finally(() => {
          if (chatControllerRef.current === chatController) {
            chatControllerRef.current = null;
          }
        });
    },
    [
      answeredTurns,
      companyId,
      customQuestionStrength,
      maxTurns,
      questionStrength,
      turns,
    ],
  );

  const confirmExit = useCallback(() => {
    if (exitAction === null) return;
    const action = exitAction;
    const evaluationTurns = turns;
    if (!finishInterview()) return;

    if (action === "home") {
      router.push("/");
      return;
    }
    void goToEvaluation(evaluationTurns, true);
  }, [exitAction, finishInterview, goToEvaluation, router, turns]);

  const requestHomeExit = useCallback(() => {
    if (canEnd) {
      setExitAction("home");
      return;
    }
    if (finishInterview()) router.push("/");
  }, [canEnd, finishInterview, router]);

  if (!isTutorial && companyId === null) {
    return (
      <div className="grid min-h-dvh place-items-center text-body-sm text-danger">
        対象企業が指定されていません。練習の設定から開始してください。
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col">
      <SessionHeader
        title={isTutorial ? "チュートリアル" : "本番モード"}
        right={
          isTutorial ? (
            !hasReachedTurnLimit ? (
              <div className="flex items-center gap-3">
                {!canEnd && (
                  <span className="text-note text-ink-muted">
                    1問以上答えると評価できます。
                  </span>
                )}
                <Button
                  variant="danger"
                  size="xs"
                  disabled={!canEnd || evaluating}
                  onClick={() => setConfirmingEnd(true)}
                  className="font-medium"
                >
                  {evaluating ? "評価を開始しています" : "面接を終える"}
                </Button>
              </div>
            ) : undefined
          ) : (
            <div className="flex items-center gap-3">
              {!canEnd && (
                <span className="text-note text-ink-muted">
                  1問以上答えると評価できます。
                </span>
              )}
              <Button
                variant="secondary"
                size="xs"
                disabled={exitStarted}
                onClick={requestHomeExit}
              >
                ホーム
              </Button>
              {!hasReachedTurnLimit && (
                <Button
                  variant="danger"
                  size="xs"
                  disabled={!canEnd || exitStarted}
                  onClick={() => setExitAction("interrupt")}
                  className="font-medium"
                >
                  中断
                </Button>
              )}
            </div>
          )
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
                {companyName ?? "企業情報を読み込んでいます"}
              </Chip>
              <Chip tone="muted" className="px-2.5 py-[5px] text-label">
                質問の強度：{QUESTION_STRENGTH_LABEL[questionStrength]}
              </Chip>
            </>
          )}
          <Chip tone="muted" className="px-2.5 py-[5px] text-label">
            回答方式：{ANSWER_METHOD_LABEL[answerMethod]}
          </Chip>
          <div className="flex items-center gap-2 text-label text-ink-sub">
            <span>読み上げ：</span>
            <div className="flex overflow-hidden rounded-control border border-line-strong">
              {READ_ALOUD_MODES.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`読み上げモード: ${READ_ALOUD_MODE_LABEL[value]}`}
                  aria-pressed={readAloudMode === value}
                  onClick={() => {
                    if (value === readAloudMode) return;
                    setReadAloudMode(value);
                    if (value === "disabled") {
                      stopSpeech();
                    }
                  }}
                  className={cn(
                    "h-7 px-2.5 text-note",
                    readAloudMode === value
                      ? "bg-accent font-medium text-white"
                      : "bg-surface text-ink-label hover:bg-canvas",
                  )}
                >
                  {READ_ALOUD_MODE_LABEL[value]}
                </button>
              ))}
            </div>
          </div>
          {!isTutorial && (
            <div className="flex items-center gap-2 text-label text-ink-sub">
              <span>会話ログ：</span>
              <div className="flex overflow-hidden rounded-control border border-line-strong">
                {TRANSCRIPT_DISPLAY_MODES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-label={`文字起こし表示: ${TRANSCRIPT_DISPLAY_MODE_LABEL[value]}`}
                    aria-pressed={transcriptDisplayMode === value}
                    onClick={() => setTranscriptDisplayMode(value)}
                    className={cn(
                      "h-7 px-2.5 text-note",
                      transcriptDisplayMode === value
                        ? "bg-accent font-medium text-white"
                        : "bg-surface text-ink-label hover:bg-canvas",
                    )}
                  >
                    {TRANSCRIPT_DISPLAY_MODE_LABEL[value]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-label text-ink-sub">
            ターン {currentTurn} / {maxTurns}
          </span>
          <div
            role="progressbar"
            aria-label="完了したターン数"
            aria-valuemin={0}
            aria-valuemax={maxTurns}
            aria-valuenow={answeredTurns}
            className="flex max-w-[260px] gap-1"
          >
            {Array.from({ length: maxTurns }, (_, index) => (
              <span
                key={index}
                className={cn(
                  "block h-[5px] w-[26px] min-w-0 rounded-[2px]",
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
            <ChatMessage
              key={index}
              turn={turn}
              transcriptDisplayMode={transcriptDisplayMode}
              speechStatus={
                speechState.turnIndex === index ? speechState.status : "idle"
              }
              onToggleSpeech={() => toggleSpeech(index, turn.content)}
            />
          ))}
          {hasReachedTurnLimit && (
            <ChatMessage
              turn={COMPLETION_TURN}
              speechStatus="idle"
              onToggleSpeech={() => undefined}
              speechEnabled={false}
            />
          )}
          {waiting && <ThinkingMessage />}
          <div ref={logEndRef} />
        </div>
      </div>

      <div className="flex-none border-t border-line bg-surface pt-5 pb-6">
        <div className="mx-auto flex w-[880px] flex-col gap-3.5">
          {apiError && (
            <p role="alert" className="rounded-control border border-danger/30 bg-danger/5 px-3 py-2 text-note text-danger">
              {apiError}
            </p>
          )}
          {hasReachedTurnLimit && (
            <div className="flex items-center justify-between gap-6 rounded-card border border-accent/30 bg-accent-soft px-5 py-4">
              <p className="text-body-sm text-ink-sub">
                面接が終了しました。会話内容を確認してから評価へ進んでください。
              </p>
              <Button
                size="sm"
                disabled={evaluating}
                onClick={() => void goToEvaluation()}
              >
                {evaluating ? "評価を開始しています" : "評価を見る"}
              </Button>
            </div>
          )}
          <InputPanel
            onSubmit={handleSubmit}
            waiting={waiting || evaluating}
            disabled={hasReachedTurnLimit}
            exitSignal={interviewController.signal}
          />
          <p className="text-note text-ink-muted">
            {hasReachedTurnLimit
              ? "この画面を離れると会話は失われます。評価は「評価を見る」を押したあとに行われます。"
              : "この画面を離れると会話は失われます。評価は「中断」を押したあとに行われます。"}
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={confirmingEnd}
        message="評価に進みます。この会話には戻れません。"
        confirmLabel="評価に進む"
        confirmVariant="primary"
        onConfirm={() => void goToEvaluation()}
        onCancel={() => setConfirmingEnd(false)}
      />
      <ConfirmDialog
        open={exitAction !== null}
        message={
          exitAction === "interrupt"
            ? "評価に進みます。この会話には戻れません。"
            : "ホームに戻ると、この会話は失われます。評価は行われません。"
        }
        confirmLabel={exitAction === "interrupt" ? "中断して評価に進む" : "ホームに戻る"}
        confirmVariant={exitAction === "interrupt" ? "primary" : "dangerSolid"}
        onConfirm={confirmExit}
        onCancel={() => setExitAction(null)}
      />
    </div>
  );
}
