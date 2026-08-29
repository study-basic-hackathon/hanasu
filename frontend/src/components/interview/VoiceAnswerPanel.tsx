"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import type { InterviewInputProps } from "@/components/interview/InterviewInput";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ApiError } from "@/lib/api-client";
import { formatElapsed } from "@/lib/format";
import {
  RECORDING_MAX_SECONDS,
  RECORDING_MIN_SECONDS,
  SILENCE_LIMIT_SECONDS,
} from "@/lib/interview";
import { transcribeAudio } from "@/lib/interview-api";

type RecordingState = "idle" | "requesting" | "recording" | "transcribing";
const WAVE_BARS = 30;
const AUDIO_LEVEL_THRESHOLD = 8;

const MIC_UNAVAILABLE_MESSAGE =
  "マイクを使えません。ブラウザの設定で許可するか、文字入力モードで始め直してください。";

function initialLevels(): number[] {
  return Array.from({ length: WAVE_BARS }, () => 4);
}

function preferredMimeType(): string | undefined {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

function transcriptionFailureMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "サインインの有効期限が切れました。もう一度サインインしてください。";
    }
    if (error.status === 413) {
      return "録音データが大きすぎます。短く区切ってもう一度お試しください。";
    }
  }
  return "聞き取れませんでした。もう一度お話しください。";
}

/** 音声入力モードの回答欄（S-08 6章）。 */
export function VoiceAnswerPanel({
  onSubmit,
  waiting,
  disabled,
  exitSignal,
}: InterviewInputProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // マイクが使えないときの移り先。設定はクエリのまま引き継ぐ
  const query = searchParams.toString();
  const textModeHref =
    pathname.replace(/\/voice$/, "/text") + (query === "" ? "" : `?${query}`);
  const [recording, setRecording] = useState<RecordingState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [silence, setSilence] = useState(0);
  const [levels, setLevels] = useState<number[]>(initialLevels);
  const [notice, setNotice] = useState<string | null>(null);
  // マイクが使えないと分かったら、録音の操作を押せなくして移行の導線だけ残す
  const [micBlocked, setMicBlocked] = useState(false);
  const [confirmingTextMode, setConfirmingTextMode] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const discardRef = useRef(false);
  const hasSpokenRef = useRef(false);
  const silentFromRef = useRef<number | null>(null);
  const sttControllerRef = useRef<AbortController | null>(null);
  const disposedRef = useRef(false);

  const releaseAudio = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    analyserRef.current = null;
  }, []);

  const discardTemporaryState = useCallback(() => {
    discardRef.current = true;
    sttControllerRef.current?.abort();
    sttControllerRef.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    recorderRef.current = null;
    chunksRef.current = [];
    releaseAudio();
    setRecording("idle");
    setElapsed(0);
    setSilence(0);
    setLevels(initialLevels());
    setNotice(null);
  }, [releaseAudio]);

  useEffect(() => {
    if (!exitSignal || exitSignal.aborted) return;
    exitSignal.addEventListener("abort", discardTemporaryState);
    return () => exitSignal.removeEventListener("abort", discardTemporaryState);
  }, [discardTemporaryState, exitSignal]);

  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
      discardRef.current = true;
      sttControllerRef.current?.abort();
      sttControllerRef.current = null;
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      recorderRef.current = null;
      chunksRef.current = [];
      releaseAudio();
    };
  }, [releaseAudio]);

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
    if (disposedRef.current || exitSignal?.aborted) return;
    setNotice(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setNotice(MIC_UNAVAILABLE_MESSAGE);
      setMicBlocked(true);
      return;
    }

    setRecording("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (disposedRef.current || exitSignal?.aborted) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
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
        if (disposedRef.current || exitSignal?.aborted) return;
        if (seconds < RECORDING_MIN_SECONDS) {
          setRecording("idle");
          setNotice("録音が短すぎます。もう一度お試しください。");
          return;
        }

        setRecording("transcribing");
        const sttController = new AbortController();
        sttControllerRef.current?.abort();
        sttControllerRef.current = sttController;
        transcribeAudio(audio, sttController.signal)
          .then((result) => {
            if (
              disposedRef.current ||
              exitSignal?.aborted ||
              sttController.signal.aborted
            ) {
              return;
            }
            setRecording("idle");
            onSubmit(result.clean_transcript, {
              rawContent: result.raw_transcript,
              audioSeconds: Math.round(result.duration_ms / 1000),
              audioDurationMs: result.duration_ms,
              characterCount: result.chars,
              fillerCount: result.filler_count,
              fillerCountPerMin: result.filler_count_per_min,
              charsPerMin: result.chars_per_min,
            });
          })
          .catch((error: unknown) => {
            if (
              disposedRef.current ||
              exitSignal?.aborted ||
              sttController.signal.aborted
            ) {
              return;
            }
            setRecording("idle");
            setNotice(transcriptionFailureMessage(error));
          })
          .finally(() => {
            if (sttControllerRef.current === sttController) {
              sttControllerRef.current = null;
            }
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
      setNotice(MIC_UNAVAILABLE_MESSAGE);
      setMicBlocked(true);
    }
  }

  const isRecording = recording === "recording";
  const isBusy = recording !== "idle";
  const hasExited = exitSignal?.aborted ?? false;
  const remainingSilence = Math.max(0, SILENCE_LIMIT_SECONDS - silence);

  return (
    <div className="flex flex-col gap-3.5">
      {isRecording && (
        <div className="flex items-center justify-end gap-2 text-label text-danger">
          <span className="block size-2 rounded-full bg-danger" />
          録音中 {formatElapsed(elapsed)}
        </div>
      )}

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
              disabled={isBusy || waiting || disabled || hasExited || micBlocked}
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
                  : micBlocked
                    ? "マイクを使えません"
                    : "押して回答を録音します"}
            </span>
          </>
        )}
      </div>

      {notice && <p role="alert" className="text-note text-danger">{notice}</p>}
      {/* 画面内では方式を切り替えない。始め直すことでだけ文字入力へ移る */}
      {micBlocked && (
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() => setConfirmingTextMode(true)}
        >
          文字入力モードで始め直す
        </Button>
      )}

      <ConfirmDialog
        open={confirmingTextMode}
        message="文字入力モードで始め直します。ここまでの会話は失われ、評価は行われません。"
        confirmLabel="始め直す"
        confirmVariant="primary"
        onConfirm={() => {
          setConfirmingTextMode(false);
          router.replace(textModeHref);
        }}
        onCancel={() => setConfirmingTextMode(false)}
      />
    </div>
  );
}
