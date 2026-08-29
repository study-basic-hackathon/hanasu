"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import type { InterviewInputProps } from "@/components/interview/InterviewInput";
import { VoiceSettingsPanel } from "@/components/interview/VoiceSettingsPanel";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import {
  DEFAULT_INPUT_THRESHOLD,
  DEFAULT_SILENCE_SECONDS,
  RECORDING_MAX_SECONDS,
  RECORDING_MIN_SECONDS,
} from "@/lib/interview";
import { transcribeAudio } from "@/lib/interview-api";

/** マイクの取得状況。取得できるまでは何も聞けない */
type MicState = "requesting" | "ready" | "blocked";

/** 録音中の1発話。捨てる判断を区間ごとに閉じ込める */
type Segment = {
  recorder: MediaRecorder;
  discard: () => void;
};

const MIC_UNAVAILABLE_MESSAGE =
  "マイクを使えません。ブラウザの設定で許可するか、文字入力モードで始め直してください。";

const HELP_TEXT =
  "面接のあいだ、マイクはつけたままです。話し終えて少し黙ると、そこまでを回答として送ります。待たずに送りたいときは「次の質問へ」を押してください。面接官が話しているあいだと、返事を待っているあいだはマイクを止めます。";

/** 入力レベルの取りうる幅。外周リングの広がりに使う */
const MAX_INPUT_LEVEL = 60;

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
      return "うまく聞き取れませんでした。少し短く区切ってお話しください。";
    }
  }
  return "聞き取れませんでした。もう一度お話しください。";
}

/**
 * 音声入力モードの回答欄（S-08 6.1）。
 * 面接のあいだ録音を止めず、無音が続いたところで発話を1ターンとして送る。
 * 面接官の番（文字起こし・返事待ち・読み上げ）はマイクを止め、ターンを交互に保つ。
 */
export function VoiceAnswerPanel({
  onSubmit,
  waiting,
  disabled,
  interviewerSpeaking,
  speechPlaybackRate,
  onChangeSpeechPlaybackRate,
  exitSignal,
}: InterviewInputProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // マイクが使えないときの移り先。設定はクエリのまま引き継ぐ
  const query = searchParams.toString();
  const textModeHref =
    pathname.replace(/\/voice$/, "/text") + (query === "" ? "" : `?${query}`);

  const [micState, setMicState] = useState<MicState>("requesting");
  const [muted, setMuted] = useState(false);
  // 発話を拾ったかどうか。表示の持ち主は下の測定ループだけにする
  const [heard, setHeard] = useState(false);
  const [silence, setSilence] = useState(0);
  const [level, setLevel] = useState(0);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [openedPopover, setOpenedPopover] = useState<"settings" | "help" | null>(
    null,
  );
  const [confirmingTextMode, setConfirmingTextMode] = useState(false);
  const [silenceSeconds, setSilenceSeconds] = useState(DEFAULT_SILENCE_SECONDS);
  const [inputThreshold, setInputThreshold] = useState(DEFAULT_INPUT_THRESHOLD);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const segmentRef = useRef<Segment | null>(null);
  const startedAtRef = useRef(0);
  const spokeFromRef = useRef<number | null>(null);
  const silentFromRef = useRef<number | null>(null);
  const sttControllerRef = useRef<AbortController | null>(null);
  const disposedRef = useRef(false);
  const noticeTimerRef = useRef<number | null>(null);

  const hasExited = exitSignal.aborted;
  // 面接官の番、ミュート、終了のあいだはマイクを止める
  const listening =
    micState === "ready" &&
    !muted &&
    !sending &&
    !waiting &&
    !interviewerSpeaking &&
    !disabled &&
    !hasExited;

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => {
      if (!disposedRef.current) setNotice(null);
      noticeTimerRef.current = null;
    }, 4_000);
  }, []);

  const releaseAudio = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    analyserRef.current = null;
  }, []);

  /** 録音中の区間を捨てる。ミュートや面接官の番に入るとき、物音だけだったときに使う */
  const discardSegment = useCallback(() => {
    const segment = segmentRef.current;
    segmentRef.current = null;
    if (!segment) return;
    segment.discard();
    if (segment.recorder.state === "recording") segment.recorder.stop();
  }, []);

  const discardTemporaryState = useCallback(() => {
    sttControllerRef.current?.abort();
    sttControllerRef.current = null;
    discardSegment();
    releaseAudio();
    setSending(false);
    setNotice(null);
  }, [discardSegment, releaseAudio]);

  useEffect(() => {
    if (exitSignal.aborted) return;
    exitSignal.addEventListener("abort", discardTemporaryState);
    return () => exitSignal.removeEventListener("abort", discardTemporaryState);
  }, [discardTemporaryState, exitSignal]);

  // マイクは画面を開いたときに一度だけ取得し、面接のあいだ持ち続ける
  useEffect(() => {
    disposedRef.current = false;
    let cancelled = false;

    async function acquireMicrophone() {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      ) {
        setMicState("blocked");
        setNotice(MIC_UNAVAILABLE_MESSAGE);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        if (cancelled || disposedRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        audioContext.createMediaStreamSource(stream).connect(analyser);
        streamRef.current = stream;
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
        setMicState("ready");
      } catch {
        if (cancelled || disposedRef.current) return;
        setMicState("blocked");
        setNotice(MIC_UNAVAILABLE_MESSAGE);
      }
    }

    void acquireMicrophone();

    return () => {
      cancelled = true;
      disposedRef.current = true;
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current);
        noticeTimerRef.current = null;
      }
      sttControllerRef.current?.abort();
      sttControllerRef.current = null;
      discardSegment();
      releaseAudio();
    };
  }, [discardSegment, releaseAudio]);

  const sendSegment = useCallback(
    (audio: Blob) => {
      setSending(true);
      const sttController = new AbortController();
      sttControllerRef.current?.abort();
      sttControllerRef.current = sttController;

      transcribeAudio(audio, sttController.signal)
        .then((result) => {
          if (disposedRef.current || sttController.signal.aborted) return;
          setSending(false);
          // 物音や独り言で文字が起きなかった区間は、黙って捨てて聞き続ける
          if (result.clean_transcript.trim() === "") return;
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
          if (disposedRef.current || sttController.signal.aborted) return;
          setSending(false);
          showNotice(transcriptionFailureMessage(error));
        })
        .finally(() => {
          if (sttControllerRef.current === sttController) {
            sttControllerRef.current = null;
          }
        });
    },
    [onSubmit, showNotice],
  );

  /** 1発話ぶんの録音を始める。区切るたびに録り直すことで、毎回そのまま送れる形にする */
  const startSegment = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || segmentRef.current) return;

    const mimeType = preferredMimeType();
    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined,
    );
    const chunks: Blob[] = [];
    // 捨てる判断は区間ごとに持つ。次の区間の開始が前の stop に影響しないようにする
    let discarded = false;
    spokeFromRef.current = null;
    silentFromRef.current = null;
    startedAtRef.current = Date.now();

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });
    recorder.addEventListener("stop", () => {
      if (segmentRef.current?.recorder === recorder) segmentRef.current = null;
      if (discarded || disposedRef.current || exitSignal.aborted) return;
      sendSegment(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
    });

    recorder.start(250);
    segmentRef.current = {
      recorder,
      discard: () => {
        discarded = true;
      },
    };
  }, [exitSignal, sendSegment]);

  /** 発話の終わりとして区切り、文字起こしへ送る */
  const closeSegment = useCallback(() => {
    const segment = segmentRef.current;
    if (!segment || segment.recorder.state !== "recording") return;
    setHeard(false);
    setSilence(0);
    setSending(true);
    segment.recorder.stop();
  }, []);

  /** 物音だけの区間を捨てて、そのまま次の発話を待つ */
  const restartSegment = useCallback(() => {
    discardSegment();
    setHeard(false);
    setSilence(0);
    startSegment();
  }, [discardSegment, startSegment]);

  // 聞ける状態のあいだだけ録音し、面接官の番に入ったら区間ごと捨てる
  useEffect(() => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (listening) {
      if (track) track.enabled = true;
      startSegment();
      return;
    }
    if (track) track.enabled = false;
    discardSegment();
  }, [discardSegment, listening, startSegment]);

  useEffect(() => {
    if (!listening) return;

    let initialized = false;
    const timer = window.setInterval(() => {
      const analyser = analyserRef.current;
      if (!analyser) return;
      // 前の発話の表示を引きずらないよう、聞き始めの1回で戻す
      if (!initialized) {
        initialized = true;
        setHeard(false);
        setSilence(0);
      }

      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      const average = data.reduce((sum, value) => sum + value, 0) / data.length;
      setLevel(Math.min(MAX_INPUT_LEVEL, average));

      if (average >= inputThreshold) {
        spokeFromRef.current ??= Date.now();
        silentFromRef.current = null;
        setHeard(true);
        setSilence(0);
      } else if (spokeFromRef.current !== null) {
        const spokeFrom = spokeFromRef.current;
        silentFromRef.current ??= Date.now();
        const silentSeconds = (Date.now() - silentFromRef.current) / 1000;
        setSilence(silentSeconds);
        if (silentSeconds >= silenceSeconds) {
          // 咳や物音のように短すぎる発話は、回答にせず捨てて聞き直す
          const spokenSeconds = (silentFromRef.current - spokeFrom) / 1000;
          if (spokenSeconds < RECORDING_MIN_SECONDS) restartSegment();
          else closeSegment();
          return;
        }
      }

      if ((Date.now() - startedAtRef.current) / 1000 >= RECORDING_MAX_SECONDS) {
        closeSegment();
      }
    }, 100);

    return () => window.clearInterval(timer);
  }, [closeSegment, inputThreshold, listening, restartSegment, silenceSeconds]);

  const statusText = (() => {
    if (micState === "requesting") return "マイクの使用許可を確認しています";
    if (micState === "blocked") return "マイクを使えません";
    if (hasExited) return "面接を終えました";
    if (disabled) return "面接が終了しました";
    if (interviewerSpeaking) return "面接官が話しています";
    if (waiting) return "面接官が考えています";
    if (sending) return "文字起こししています";
    if (muted) return "ミュート中。押すと再開します";
    if (heard && silence > 0) {
      const remaining = Math.max(0, silenceSeconds - silence);
      return `あと ${remaining.toFixed(1)} 秒で送ります`;
    }
    if (heard) return "聞き取り中…";
    return "どうぞお話しください";
  })();

  // 外周リングは、聞いているあいだだけ音量で広がる
  const ringWidth = listening ? 6 + Math.round((level / MAX_INPUT_LEVEL) * 14) : 6;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="relative flex flex-col items-center gap-3 rounded-card border border-line bg-[#fbfcfc] px-6 py-5">
        <p
          aria-live="polite"
          className="rounded-card border border-line bg-surface px-4 py-2 text-body-sm text-ink-sub"
        >
          {statusText}
        </p>

        <div className="flex w-full items-center justify-center gap-10">
          <button
            type="button"
            aria-label="音声の設定"
            aria-expanded={openedPopover === "settings"}
            onClick={() =>
              setOpenedPopover((current) =>
                current === "settings" ? null : "settings",
              )
            }
            className="grid size-10 place-items-center rounded-full text-[20px] text-ink-sub hover:bg-canvas"
          >
            ⚙
          </button>

          <button
            type="button"
            aria-label={muted ? "マイクをオンにする" : "マイクをミュートする"}
            aria-pressed={muted}
            disabled={micState !== "ready" || disabled || hasExited}
            onClick={() => setMuted((current) => !current)}
            style={{
              boxShadow: `0 0 0 ${ringWidth}px ${muted ? "#eceff1" : "#e4efee"}`,
            }}
            className={cn(
              "grid size-16 flex-none place-items-center rounded-full transition-[box-shadow] duration-100 disabled:cursor-not-allowed disabled:opacity-50",
              muted ? "bg-[#8a9299]" : "bg-accent",
            )}
          >
            {muted ? (
              <span className="block h-0.5 w-6 rounded-full bg-white" />
            ) : (
              <span className="block size-5 rounded-full bg-white" />
            )}
          </button>

          <button
            type="button"
            aria-label="音声入力の使い方"
            aria-expanded={openedPopover === "help"}
            onClick={() =>
              setOpenedPopover((current) => (current === "help" ? null : "help"))
            }
            className="grid size-10 place-items-center rounded-full text-[20px] text-ink-sub hover:bg-canvas"
          >
            ?
          </button>
        </div>

        {/* 無音を待たずに回答を確定させる。何も話していないうちは押せない */}
        <Button
          variant="secondary"
          size="sm"
          disabled={!listening || !heard}
          onClick={closeSegment}
        >
          次の質問へ
        </Button>

        {openedPopover === "settings" && (
          <VoiceSettingsPanel
            silenceSeconds={silenceSeconds}
            onChangeSilenceSeconds={setSilenceSeconds}
            inputThreshold={inputThreshold}
            onChangeInputThreshold={setInputThreshold}
            speechPlaybackRate={speechPlaybackRate}
            onChangeSpeechPlaybackRate={onChangeSpeechPlaybackRate}
            level={level}
            maxLevel={MAX_INPUT_LEVEL}
            onClose={() => setOpenedPopover(null)}
          />
        )}
        {openedPopover === "help" && (
          <div
            role="note"
            className="absolute bottom-[calc(100%-8px)] right-6 w-[320px] rounded-card border border-line bg-surface p-4 text-note leading-[1.8] text-ink-sub shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
          >
            {HELP_TEXT}
          </div>
        )}
      </div>

      {notice && <p role="alert" className="text-note text-danger">{notice}</p>}
      {/* 画面内では方式を切り替えない。始め直すことでだけ文字入力へ移る */}
      {micState === "blocked" && (
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
