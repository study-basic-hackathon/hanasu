"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatElapsed } from "@/lib/format";
import {
  countFillers,
  RECORDING_MAX_SECONDS,
  RECORDING_MIN_SECONDS,
  SILENCE_LIMIT_SECONDS,
} from "@/lib/interview";
import { MOCK_TRANSCRIPTS } from "@/mocks/conversation";
import type { AnswerMethod } from "@/mocks/types";

type AnswerPanelProps = {
  answerMethod: AnswerMethod;
  onChangeAnswerMethod: (method: AnswerMethod) => void;
  /** 回答を送る。音声のターンだけ秒数とフィラー数を添える */
  onSubmit: (
    content: string,
    detail?: { audioSeconds: number; fillerCount: number },
  ) => void;
  /** 面接官の応答を待っているあいだは操作させない */
  waiting?: boolean;
};

const METHOD_LABEL: Record<AnswerMethod, string> = {
  voice: "音声で回答",
  text: "文字入力で回答",
};

/** 録音の状態（S-08 6.1） */
type RecordingState = "idle" | "recording" | "transcribing";

/** 波形の本数 */
const WAVE_BARS = 30;

/**
 * モックでは MediaRecorder を使わないため、この秒数だけ話したものとみなす。
 * 以降は無音として扱い、無音の表示と自動停止を確かめられるようにする。
 */
const MOCK_SPEAKING_SECONDS = 6;

function makeLevels(speaking: boolean): number[] {
  return Array.from({ length: WAVE_BARS }, () =>
    speaking
      ? 6 + Math.floor(Math.random() * 40)
      : 4 + Math.floor(Math.random() * 4),
  );
}

/**
 * 回答の入力（S-08 6章）。
 * 回答方式は会話の途中でも切り替えられ、切り替えても会話は続く。
 */
export function AnswerPanel({
  answerMethod,
  onChangeAnswerMethod,
  onSubmit,
  waiting = false,
}: AnswerPanelProps) {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState<RecordingState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [silence, setSilence] = useState(0);
  const [levels, setLevels] = useState<number[]>(() =>
    Array.from({ length: WAVE_BARS }, () => 4),
  );
  const [notice, setNotice] = useState<string | null>(null);
  const transcriptIndex = useRef(0);
  const recordedSeconds = useRef(0);

  function submitText() {
    const content = text.trim();
    if (content === "") return;
    setText("");
    onSubmit(content);
  }

  /** 録音を止める。最短に満たなければ送らない（S-08 6.1） */
  const stopRecording = useCallback((seconds: number) => {
    recordedSeconds.current = seconds;
    if (seconds < RECORDING_MIN_SECONDS) {
      setRecording("idle");
      setNotice("録音が短すぎます。もう一度お試しください。");
      return;
    }
    setRecording("transcribing");
  }, []);

  // 経過時間と無音の長さを進める
  useEffect(() => {
    if (recording !== "recording") return;
    const startedAt = Date.now();
    let silentFrom: number | null = null;

    const timer = setInterval(() => {
      const seconds = (Date.now() - startedAt) / 1000;
      setElapsed(seconds);

      const speaking = seconds < MOCK_SPEAKING_SECONDS;
      setLevels(makeLevels(speaking));
      if (speaking) {
        silentFrom = null;
        setSilence(0);
      } else {
        silentFrom ??= Date.now();
        const silentSeconds = (Date.now() - silentFrom) / 1000;
        setSilence(silentSeconds);
        // 無音が続いたら停止して送信する
        if (silentSeconds >= SILENCE_LIMIT_SECONDS) stopRecording(seconds);
      }
      // 最長を超えたら自動で停止して送信する
      if (seconds >= RECORDING_MAX_SECONDS) stopRecording(seconds);
    }, 100);

    return () => clearInterval(timer);
  }, [recording, stopRecording]);

  // モックでは文字起こしの API を呼ばず、見本の結果を少し待ってから返す
  useEffect(() => {
    if (recording !== "transcribing") return;
    const timer = setTimeout(() => {
      const content =
        MOCK_TRANSCRIPTS[transcriptIndex.current % MOCK_TRANSCRIPTS.length];
      transcriptIndex.current += 1;
      setRecording("idle");
      onSubmit(content, {
        audioSeconds: Math.round(recordedSeconds.current),
        fillerCount: countFillers(content),
      });
    }, 1200);

    return () => clearTimeout(timer);
  }, [recording, onSubmit]);

  function startRecording() {
    setNotice(null);
    setElapsed(0);
    setSilence(0);
    setRecording("recording");
  }

  const isRecording = recording === "recording";
  const isTranscribing = recording === "transcribing";
  const remainingSilence = Math.max(0, SILENCE_LIMIT_SECONDS - silence);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div className="flex overflow-hidden rounded-control border border-line-strong">
          {(["voice", "text"] as AnswerMethod[]).map((method) => (
            <button
              key={method}
              type="button"
              aria-pressed={answerMethod === method}
              disabled={isRecording || isTranscribing}
              onClick={() => onChangeAnswerMethod(method)}
              className={cn(
                "h-8 px-[18px] text-label disabled:cursor-not-allowed",
                answerMethod === method
                  ? "bg-accent font-medium text-white"
                  : "text-ink-label hover:bg-canvas",
              )}
            >
              {METHOD_LABEL[method]}
            </button>
          ))}
        </div>
        {isRecording && (
          <div className="flex items-center gap-2 text-label text-danger">
            <span className="block size-2 rounded-full bg-danger" />
            録音中 {formatElapsed(elapsed)}
          </div>
        )}
      </div>

      {answerMethod === "voice" ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-6 rounded-card border border-line bg-[#fbfcfc] px-6 py-5">
            {isRecording ? (
              <>
                <button
                  type="button"
                  aria-label="録音を停止して送信する"
                  onClick={() => stopRecording(elapsed)}
                  className="grid size-16 flex-none place-items-center rounded-full bg-danger shadow-[0_0_0_6px_#f7e6e5]"
                >
                  <span className="block size-5 rounded-[3px] bg-white" />
                </button>
                <div className="flex flex-1 flex-col gap-2.5">
                  <div className="flex h-[46px] items-end gap-[3px]">
                    {levels.map((level, index) => (
                      <span
                        key={index}
                        className="block w-1 rounded-[2px] bg-accent"
                        style={{ height: `${level}px` }}
                      />
                    ))}
                  </div>
                  {/* 無音が続いているあいだの表示（S-08 6.1） */}
                  {silence > 0 && (
                    <div className="flex items-center gap-2.5 text-note text-ink-sub">
                      <span className="rounded-chip border border-[#f0e0b8] bg-[#fdf6e7] px-2 py-1 font-medium text-[#8a6a12]">
                        無音 {silence.toFixed(1)} 秒
                      </span>
                      <span>
                        あと {remainingSilence.toFixed(1)} 秒
                        静かなままだと自動で停止します
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex w-[150px] flex-none flex-col gap-2">
                  <Button
                    size="xs"
                    className="h-[38px] w-full"
                    onClick={() => stopRecording(elapsed)}
                  >
                    停止して送信
                  </Button>
                  {/* 録音を捨てて待機に戻す。会話ログは変わらない */}
                  <Button
                    variant="secondary"
                    size="xs"
                    className="h-8 w-full text-label"
                    onClick={() => setRecording("idle")}
                  >
                    取り消す
                  </Button>
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  aria-label="回答を録音する"
                  disabled={isTranscribing || waiting}
                  onClick={startRecording}
                  className="grid size-16 flex-none place-items-center rounded-full bg-accent shadow-[0_0_0_6px_#e4efee] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="block size-5 rounded-full bg-white" />
                </button>
                <span className="text-body-sm text-ink-sub">
                  {isTranscribing
                    ? "文字起こししています"
                    : "押して回答を録音します"}
                </span>
              </>
            )}
          </div>
          {notice && <p className="text-note text-danger">{notice}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-card border border-line bg-[#fbfcfc] px-6 py-5">
          <textarea
            rows={3}
            value={text}
            disabled={waiting}
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
            <Button
              size="sm"
              disabled={text.trim() === "" || waiting}
              onClick={submitText}
            >
              送信する
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
