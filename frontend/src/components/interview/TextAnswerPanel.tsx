"use client";

import { useCallback, useEffect, useState } from "react";

import type { InterviewInputProps } from "@/components/interview/InterviewInput";
import { Button } from "@/components/ui/Button";

/** 文字入力モードの回答欄（S-08 6章）。 */
export function TextAnswerPanel({
  onSubmit,
  waiting,
  disabled,
  exitSignal,
}: InterviewInputProps) {
  const [text, setText] = useState("");

  const discardTemporaryState = useCallback(() => setText(""), []);

  useEffect(() => {
    if (!exitSignal || exitSignal.aborted) return;
    exitSignal.addEventListener("abort", discardTemporaryState);
    return () => exitSignal.removeEventListener("abort", discardTemporaryState);
  }, [discardTemporaryState, exitSignal]);

  const hasExited = exitSignal?.aborted ?? false;

  function submitText() {
    const content = text.trim();
    if (content === "") return;
    setText("");
    onSubmit(content);
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-line bg-[#fbfcfc] px-6 py-5">
      <textarea
        rows={3}
        value={text}
        disabled={waiting || disabled || hasExited}
        placeholder="回答を入力してください"
        onChange={(event) => setText(event.target.value)}
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
        <Button
          size="sm"
          disabled={text.trim() === "" || waiting || disabled || hasExited}
          onClick={submitText}
        >
          送信する
        </Button>
      </div>
    </div>
  );
}
