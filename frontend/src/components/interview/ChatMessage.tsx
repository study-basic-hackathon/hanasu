"use client";

import { cn } from "@/lib/cn";
import type { ChatTurn, TranscriptDisplayMode } from "@/lib/domain";
import {
  SCORE_TEXT_CLASS,
  SPEAKING_SPEED_RANGE,
  scoreFillerRate,
  scoreLevel,
  scoreSpeakingSpeed,
} from "@/lib/score";

export type SpeechStatus = "idle" | "loading" | "playing" | "error";

/**
 * 会話ログの1件（S-08 5章）。
 * 面接官は左・白い吹き出し、自分は右・アクセント色の吹き出し。
 */
export function ChatMessage({
  turn,
  transcriptDisplayMode = "clean",
  speechStatus,
  onToggleSpeech,
  speechEnabled = true,
}: {
  turn: ChatTurn;
  transcriptDisplayMode?: TranscriptDisplayMode;
  speechStatus: SpeechStatus;
  onToggleSpeech: () => void;
  speechEnabled?: boolean;
}) {
  const isSelf = turn.role === "user";
  const content =
    transcriptDisplayMode === "raw" && isVoiceAnswer(turn)
      ? (turn.raw_content ?? turn.content)
      : turn.content;

  return (
    <div className={cn("flex gap-3.5", isSelf && "justify-end")}>
      {!isSelf && <Avatar label="面接" />}
      <div
        className={cn(
          "flex max-w-[600px] flex-col gap-1.5",
          isSelf && "items-end",
        )}
      >
        <div
          className={cn(
            "px-[18px] py-4 text-body leading-[1.9]",
            isSelf
              ? "rounded-[8px_2px_8px_8px] bg-accent text-white"
              : "rounded-[2px_8px_8px_8px] border border-line bg-surface",
          )}
        >
          {content}
        </div>
        <div className="flex flex-col items-end gap-1 text-note text-ink-muted">
          {isSelf ? (
            <>
              <UserAnswerDetails turn={turn} />
            </>
          ) : (
            <div className="flex items-center gap-3">
              {turn.time && <span>{turn.time}</span>}
              {speechEnabled && (
                <SpeakButton status={speechStatus} onToggle={onToggleSpeech} />
              )}
            </div>
          )}
        </div>
      </div>
      {isSelf && <Avatar label="自分" muted />}
    </div>
  );
}

function UserAnswerDetails({ turn }: { turn: ChatTurn }) {
  if (!isVoiceAnswer(turn)) {
    return turn.time ? <span>{turn.time}</span> : null;
  }

  const speakingSpeed = measuredValue(turn.chars_per_min);
  const fillerCount = measuredValue(turn.filler_count);
  const fillerRate = measuredValue(turn.filler_count_per_min);
  const speakingLevel =
    speakingSpeed === undefined
      ? undefined
      : scoreLevel(scoreSpeakingSpeed(speakingSpeed));
  const fillerLevel =
    fillerCount === undefined || fillerRate === undefined
      ? undefined
      : scoreLevel(scoreFillerRate(fillerRate));
  const shouldReduceFillers = fillerLevel === "improve";
  const shouldSlowDown =
    speakingLevel === "improve" &&
    speakingSpeed !== undefined &&
    speakingSpeed > SPEAKING_SPEED_RANGE.max;

  return (
    <>
      <div className="flex items-center gap-3">
        {turn.audio_seconds !== undefined && (
          <span>音声 {turn.audio_seconds} 秒</span>
        )}
        <AnswerMetric
          label="話速"
          value={speakingSpeed}
          unit="文字/分"
          level={speakingLevel}
        />
        <AnswerMetric
          label="フィラー"
          value={fillerCount}
          unit="回"
          level={fillerLevel}
        />
        {turn.time && <span>{turn.time}</span>}
      </div>
      {shouldReduceFillers && (
        <p className="text-danger">次はフィラーを少なめにしましょう</p>
      )}
      {shouldSlowDown && (
        <p className="text-danger">次はもう少しゆっくり話しましょう</p>
      )}
    </>
  );
}

function isVoiceAnswer(turn: ChatTurn): boolean {
  return (
    turn.role === "user" &&
    (turn.audio_seconds !== undefined || turn.audio_duration_ms !== undefined)
  );
}

function measuredValue(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function AnswerMetric({
  label,
  value,
  unit,
  level,
}: {
  label: string;
  value: number | undefined;
  unit: string;
  level: ReturnType<typeof scoreLevel> | undefined;
}) {
  if (value === undefined || level === undefined) {
    return (
      <span>
        {label} 計測値なし
      </span>
    );
  }

  return (
    <span>
      {label} <span className={SCORE_TEXT_CLASS[level]}>{value}</span> {unit}
    </span>
  );
}

/** 面接官の応答待ち（S-08 6.1）。会話ログの末尾に置く */
export function ThinkingMessage() {
  return (
    <div className="flex gap-3.5">
      <Avatar label="面接" />
      <div className="rounded-[2px_8px_8px_8px] border border-line bg-surface px-[18px] py-4 text-body text-ink-sub">
        考えています
      </div>
    </div>
  );
}

function Avatar({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <div
      className={cn(
        "grid size-[34px] flex-none place-items-center rounded-full text-note font-bold",
        muted ? "bg-[#dde1e4] text-ink-label" : "bg-accent text-white",
      )}
    >
      {label}
    </div>
  );
}

/**
 * 「読み上げる」（S-08 5.2）。再生処理は画面共通プレイヤーへ委譲する。
 */
function SpeakButton({
  status,
  onToggle,
}: {
  status: SpeechStatus;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      disabled={status === "loading"}
      onClick={onToggle}
      className="text-accent hover:underline disabled:opacity-50"
    >
      {status === "loading"
        ? "音声を準備しています"
        : status === "playing"
          ? "停止する"
          : status === "error"
            ? "読み上げられませんでした。再試行する"
            : "読み上げる"}
    </button>
  );
}
