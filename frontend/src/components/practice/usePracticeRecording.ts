"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "@/lib/api-client";
import { transcribeAudio, type Transcription } from "@/lib/interview-api";

export type PracticeRecordingPhase =
  | "idle"
  | "requesting"
  | "recording"
  | "transcribing"
  | "success"
  | "error";

export type PracticeRecordingErrorKind =
  | "microphone"
  | "too-short"
  | "transcription";

export type PracticeRecordingError = {
  kind: PracticeRecordingErrorKind;
  message: string;
};

type UsePracticeRecordingOptions = {
  /** 録音を自動停止するまでの秒数。 */
  maxSeconds: number;
};

const MIN_RECORDING_SECONDS = 1;

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
      return "録音データが大きすぎます。もう一度録音してください。";
    }
  }
  return "文字起こしに失敗しました。音声を再送してください。";
}

/**
 * 練習画面で共通利用する、録音から一時評価値の取得までの状態管理。
 * 音声と文字起こし結果はメモリだけに保持し、リセット・画面離脱で破棄する。
 */
export function usePracticeRecording({
  maxSeconds,
}: UsePracticeRecordingOptions) {
  const [phase, setPhase] = useState<PracticeRecordingPhase>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [result, setResult] = useState<Transcription | null>(null);
  const [error, setError] = useState<PracticeRecordingError | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const discardRef = useRef(false);
  const lastAudioRef = useRef<Blob | null>(null);
  const sttControllerRef = useRef<AbortController | null>(null);
  const disposedRef = useRef(false);

  const releaseAudio = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const runTranscription = useCallback(async (audio: Blob) => {
    const controller = new AbortController();
    sttControllerRef.current?.abort();
    sttControllerRef.current = controller;
    setPhase("transcribing");
    setError(null);

    try {
      const transcription = await transcribeAudio(audio, controller.signal);
      if (disposedRef.current || controller.signal.aborted) return;
      setResult(transcription);
      setPhase("success");
    } catch (caught: unknown) {
      if (disposedRef.current || controller.signal.aborted) return;
      setPhase("error");
      setError({
        kind: "transcription",
        message: transcriptionFailureMessage(caught),
      });
    } finally {
      if (sttControllerRef.current === controller) {
        sttControllerRef.current = null;
      }
    }
  }, []);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
  }, []);

  useEffect(() => {
    if (phase !== "recording") return;

    const timer = window.setInterval(() => {
      const elapsed = (Date.now() - startedAtRef.current) / 1000;
      setElapsedSeconds(Math.min(maxSeconds, elapsed));
      if (elapsed >= maxSeconds) stopRecording();
    }, 100);

    return () => window.clearInterval(timer);
  }, [maxSeconds, phase, stopRecording]);

  const startRecording = useCallback(async () => {
    if (disposedRef.current || phase === "requesting" || phase === "recording") {
      return;
    }

    setResult(null);
    setError(null);
    lastAudioRef.current = null;

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setPhase("error");
      setError({
        kind: "microphone",
        message:
          "マイクを使用できません。ブラウザの設定で許可し、もう一度お試しください。",
      });
      return;
    }

    setPhase("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (disposedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      const mimeType = preferredMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      discardRef.current = false;

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      });
      recorder.addEventListener("error", () => {
        discardRef.current = true;
        recorderRef.current = null;
        releaseAudio();
        if (disposedRef.current) return;
        setPhase("error");
        setError({
          kind: "microphone",
          message: "録音を開始できませんでした。もう一度お試しください。",
        });
      });
      recorder.addEventListener("stop", () => {
        const elapsed = (Date.now() - startedAtRef.current) / 1000;
        const audio = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        recorderRef.current = null;
        chunksRef.current = [];
        releaseAudio();

        if (discardRef.current) {
          discardRef.current = false;
          return;
        }
        if (disposedRef.current) return;

        setElapsedSeconds(Math.min(maxSeconds, elapsed));
        if (elapsed < MIN_RECORDING_SECONDS) {
          setPhase("error");
          setError({
            kind: "too-short",
            message: "録音が短すぎます。1秒以上読み上げてください。",
          });
          return;
        }

        lastAudioRef.current = audio;
        void runTranscription(audio);
      });

      startedAtRef.current = Date.now();
      setElapsedSeconds(0);
      recorder.start(250);
      setPhase("recording");
    } catch {
      discardRef.current = true;
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
      recorderRef.current = null;
      releaseAudio();
      if (disposedRef.current) return;
      setPhase("error");
      setError({
        kind: "microphone",
        message:
          "マイクを使用できません。ブラウザの設定で許可し、もう一度お試しください。",
      });
    }
  }, [maxSeconds, phase, releaseAudio, runTranscription]);

  const reset = useCallback(() => {
    discardRef.current = true;
    sttControllerRef.current?.abort();
    sttControllerRef.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    recorderRef.current = null;
    chunksRef.current = [];
    lastAudioRef.current = null;
    releaseAudio();
    setPhase("idle");
    setElapsedSeconds(0);
    setResult(null);
    setError(null);
  }, [releaseAudio]);

  const retry = useCallback(() => {
    if (error?.kind === "transcription" && lastAudioRef.current) {
      void runTranscription(lastAudioRef.current);
      return;
    }
    void startRecording();
  }, [error?.kind, runTranscription, startRecording]);

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
      lastAudioRef.current = null;
      releaseAudio();
    };
  }, [releaseAudio]);

  return {
    phase,
    elapsedSeconds,
    result,
    error,
    startRecording,
    stopRecording,
    retry,
    reset,
  };
}
