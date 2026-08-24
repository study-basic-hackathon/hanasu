"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { AnswerMethod } from "@/lib/domain";
import { formatElapsed } from "@/lib/format";
import {
  RECORDING_MAX_SECONDS,
  RECORDING_MIN_SECONDS,
  SILENCE_LIMIT_SECONDS,
} from "@/lib/interview";
import { transcribeAudio } from "@/lib/interview-api";

export type AnswerDetail = {
  rawContent: string;
  audioSeconds: number;
  audioDurationMs: number;
  characterCount: number;
  fillerCount: number;
  charsPerMin: number;
};

type AnswerPanelProps = {
  answerMethod: AnswerMethod;
  onChangeAnswerMethod: (method: AnswerMethod) => void;
  onSubmit: (content: string, detail?: AnswerDetail) => void;
  waiting?: boolean;
};

const METHOD_LABEL: Record<AnswerMethod, string> = {
  voice: "音声で回答",
  text: "文字入力で回答",
};

type RecordingState = "idle" | "requesting" | "recording" | "transcribing";
const WAVE_BARS = 30;
const AUDIO_LEVEL_THRESHOLD = 8;

function initialLevels(): number[] {
  return Array.from({ length: WAVE_BARS }, () => 4);
}

function preferredMimeType(): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/webm"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

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
  const [levels, setLevels] = useState<number[]>(initialLevels);
  const [notice, setNotice] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const discardRef = useRef(false);
  const hasSpokenRef = useRef(false);
  const silentFromRef = useRef<number | null>(null);

  const releaseAudio = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    analyserRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      discardRef.current = true;
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      releaseAudio();
    };
  }, [releaseAudio]);

  function submitText() {
    const content = text.trim();
    if (content === "") return;
    setText("");
    onSubmit(content);
  }

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    recorder.stop();
  }, []);

  const cancelRecording = useCallback(() => {
    discardRef.current = true;
    stopRecording();
    setRecording("idle");
    setElapsed(0);
    setSilence(0);
    setLevels(initialLevels());
  }, [stopRecording]);

  useEffect(() => {
    if (recording !== "recording") return;

    const timer = window.setInterval(() => {
      const seconds = (Date.now() - startedAtRef.current) / 1000;
      setElapsed(seconds);

      const analyser = analyserRef.current;
      if (analyser) {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const average = data.reduce((sum, value) => sum + value, 0) / data.length;
        setLevels(
          Array.from({ length: WAVE_BARS }, (_, index) => {
            const value = data[Math.floor((index / WAVE_BARS) * data.length)] ?? 0;
            return Math.max(4, Math.min(46, Math.round(value / 4)));
          }),
        );

        if (average >= AUDIO_LEVEL_THRESHOLD) {
          hasSpokenRef.current = true;
          silentFromRef.current = null;
          setSilence(0);
        } else if (hasSpokenRef.current) {
          silentFromRef.current ??= Date.now();
          const silentSeconds = (Date.now() - silentFromRef.current) / 1000;
          setSilence(silentSeconds);
          if (silentSeconds >= SILENCE_LIMIT_SECONDS) stopRecording();
        }
      }

      if (seconds >= RECORDING_MAX_SECONDS) stopRecording();
    }, 100);

    return () => window.clearInterval(timer);
  }, [recording, stopRecording]);

  async function startRecording() {
    setNotice(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setNotice("このブラウザでは音声録音を利用できません。文字入力で回答してください。");
      return;
    }

    setRecording("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      audioContext.createMediaStreamSource(stream).connect(analyser);

      const mimeType = preferredMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      streamRef.current = stream;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      recorderRef.current = recorder;
      chunksRef.current = [];
      discardRef.current = false;
      hasSpokenRef.current = false;
      silentFromRef.current = null;

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      });
      recorder.addEventListener("stop", () => {
        const seconds = (Date.now() - startedAtRef.current) / 1000;
        const audio = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        releaseAudio();
        recorderRef.current = null;

        if (discardRef.current) {
          discardRef.current = false;
          return;
        }
        if (seconds < RECORDING_MIN_SECONDS) {
          setRecording("idle");
          setNotice("録音が短すぎます。もう一度お試しください。");
          return;
        }

        setRecording("transcribing");
        transcribeAudio(audio)
          .then((result) => {
            setRecording("idle");
            onSubmit(result.clean_transcript, {
              rawContent: result.raw_transcript,
              audioSeconds: Math.round(result.duration_ms / 1000),
              audioDurationMs: result.duration_ms,
              characterCount: result.chars,
              fillerCount: result.filler_count,
              charsPerMin: result.chars_per_min,
            });
          })
          .catch(() => {
            setRecording("idle");
            setNotice("文字起こしに失敗しました。時間をおいてもう一度お試しください。");
          });
      });

      setElapsed(0);
      setSilence(0);
      setLevels(initialLevels());
      startedAtRef.current = Date.now();
      recorder.start(250);
      setRecording("recording");
    } catch {
      releaseAudio();
      setRecording("idle");
      setNotice("マイクを利用できません。ブラウザの許可設定を確認してください。");
    }
  }

  const isRecording = recording === "recording";
  const isBusy = recording !== "idle";
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
              disabled={isBusy}
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
                  onClick={stopRecording}
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
                  {silence > 0 && (
                    <div className="flex items-center gap-2.5 text-note text-ink-sub">
                      <span className="rounded-chip border border-[#f0e0b8] bg-[#fdf6e7] px-2 py-1 font-medium text-[#8a6a12]">
                        無音 {silence.toFixed(1)} 秒
                      </span>
                      <span>
                        あと {remainingSilence.toFixed(1)} 秒 静かなままだと自動で停止します
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex w-[150px] flex-none flex-col gap-2">
                  <Button size="xs" className="h-[38px] w-full" onClick={stopRecording}>
                    停止して送信
                  </Button>
                  <Button
                    variant="secondary"
                    size="xs"
                    className="h-8 w-full text-label"
                    onClick={cancelRecording}
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
                  disabled={isBusy || waiting}
                  onClick={startRecording}
                  className="grid size-16 flex-none place-items-center rounded-full bg-accent shadow-[0_0_0_6px_#e4efee] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="block size-5 rounded-full bg-white" />
                </button>
                <span className="text-body-sm text-ink-sub">
                  {recording === "requesting"
                    ? "マイクの使用許可を確認しています"
                    : recording === "transcribing"
                      ? "文字起こししています"
                      : "押して回答を録音します"}
                </span>
              </>
            )}
          </div>
          {notice && <p role="alert" className="text-note text-danger">{notice}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-card border border-line bg-[#fbfcfc] px-6 py-5">
          <textarea
            rows={3}
            value={text}
            disabled={waiting}
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
            <Button size="sm" disabled={text.trim() === "" || waiting} onClick={submitText}>
              送信する
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
