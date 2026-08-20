"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { AnswerMethod } from "@/mocks/types";

type AnswerPanelProps = {
  answerMethod: AnswerMethod;
  onChangeAnswerMethod: (method: AnswerMethod) => void;
  /** 回答を送る。音声のターンだけ秒数とフィラー数を添える */
  onSubmit: (
    content: string,
    detail?: { audioSeconds: number; fillerCount: number },
  ) => void;
};

const METHOD_LABEL: Record<AnswerMethod, string> = {
  voice: "音声で回答",
  text: "文字入力で回答",
};

/**
 * 回答の入力（S-08 6章）。
 * 回答方式は会話の途中でも切り替えられ、切り替えても会話は続く。
 */
export function AnswerPanel({
  answerMethod,
  onChangeAnswerMethod,
  onSubmit,
}: AnswerPanelProps) {
  const [text, setText] = useState("");

  function submitText() {
    const content = text.trim();
    if (content === "") return;
    setText("");
    onSubmit(content);
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div className="flex overflow-hidden rounded-control border border-line-strong">
          {(["voice", "text"] as AnswerMethod[]).map((method) => (
            <button
              key={method}
              type="button"
              aria-pressed={answerMethod === method}
              onClick={() => onChangeAnswerMethod(method)}
              className={cn(
                "h-8 px-[18px] text-label",
                answerMethod === method
                  ? "bg-accent font-medium text-white"
                  : "text-ink-label hover:bg-canvas",
              )}
            >
              {METHOD_LABEL[method]}
            </button>
          ))}
        </div>
      </div>

      {answerMethod === "voice" ? (
        <VoiceAnswer />
      ) : (
        <div className="flex flex-col gap-3 rounded-card border border-line bg-[#fbfcfc] px-6 py-5">
          <textarea
            rows={3}
            value={text}
            placeholder="回答を入力してください"
            onChange={(event) => setText(event.target.value)}
            // 送信の近道（S-08 6.2）
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                submitText();
              }
            }}
            className="w-full resize-y rounded-control border border-line-strong bg-surface px-3 py-2.5 text-body leading-[1.8] placeholder:text-ink-muted focus:outline-2 focus:outline-offset-[-1px] focus:outline-accent"
          />
          <div className="flex items-center justify-end gap-3">
            <span className="text-note text-ink-muted">Ctrl + Enter で送信</span>
            <Button size="sm" disabled={text.trim() === ""} onClick={submitText}>
              送信する
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** 音声で回答（S-08 6.1）の待機。録音の各状態は #58 で作る */
function VoiceAnswer() {
  return (
    <div className="flex items-center gap-6 rounded-card border border-line bg-[#fbfcfc] px-6 py-5">
      <span className="grid size-16 flex-none place-items-center rounded-full bg-accent shadow-[0_0_0_6px_#e4efee]">
        <span className="block size-5 rounded-full bg-white" />
      </span>
      <span className="text-body-sm text-ink-sub">押して回答を録音します</span>
    </div>
  );
}
