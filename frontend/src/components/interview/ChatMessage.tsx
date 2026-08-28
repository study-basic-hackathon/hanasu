"use client";

import { cn } from "@/lib/cn";
import type { ChatTurn } from "@/lib/domain";

export type SpeechStatus = "idle" | "loading" | "playing" | "error";

/**
 * 会話ログの1件（S-08 5章）。
 * 面接官は左・白い吹き出し、自分は右・アクセント色の吹き出し。
 */
export function ChatMessage({
  turn,
  speechStatus,
  onToggleSpeech,
}: {
  turn: ChatTurn;
  speechStatus: SpeechStatus;
  onToggleSpeech: () => void;
}) {
  const isSelf = turn.role === "user";

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
          {turn.content}
        </div>
        <div className="flex items-center gap-3 text-note text-ink-muted">
          {isSelf ? (
            <>
              {/* 文字入力で答えたターンには `音声 <秒> 秒` を出さない */}
              {turn.audio_seconds !== undefined && (
                <span>音声 {turn.audio_seconds} 秒</span>
              )}
              {turn.filler_count !== undefined && (
                <span>フィラー {turn.filler_count}</span>
              )}
              <span>{turn.time}</span>
            </>
          ) : (
            <>
              {turn.time && <span>{turn.time}</span>}
              <SpeakButton status={speechStatus} onToggle={onToggleSpeech} />
            </>
          )}
        </div>
      </div>
      {isSelf && <Avatar label="自分" muted />}
    </div>
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
 * 「読み上げる」（S-08 5.1）。再生処理は画面共通プレイヤーへ委譲する。
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
