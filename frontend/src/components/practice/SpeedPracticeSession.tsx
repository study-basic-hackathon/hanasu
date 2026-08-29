"use client";

import { PracticeFinishLink } from "@/components/practice/PracticeSubLayout";
import { usePracticeRecording } from "@/components/practice/usePracticeRecording";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatElapsed, formatSpeakingSpeed } from "@/lib/format";
import {
  SCORE_BAR_CLASS,
  SCORE_TEXT_CLASS,
  SPEAKING_SPEED_RANGE,
  scoreLevel,
  scoreSpeakingSpeed,
} from "@/lib/score";

export const SPEED_MAX_SECONDS = 60;

const SCALE_MIN = 150;
const SCALE_MAX = 450;

function positionPercent(value: number): number {
  const ratio = (value - SCALE_MIN) / (SCALE_MAX - SCALE_MIN);
  return Math.min(100, Math.max(0, ratio * 100));
}

function speakingSpeedComment(charsPerMinute: number): string {
  if (charsPerMinute < SPEAKING_SPEED_RANGE.min) {
    return "遅めです。文のまとまりを意識してテンポを上げましょう。";
  }
  if (charsPerMinute > SPEAKING_SPEED_RANGE.max) {
    return "速めです。句読点で間を取り、落ち着いて話しましょう。";
  }
  return "適正な話速です。このテンポを保ちましょう。";
}

type SpeedPracticeSessionProps = {
  passage: string;
};

/** S-12 の録音・話速のみを表示する一時評価UI。 */
export function SpeedPracticeSession({ passage }: SpeedPracticeSessionProps) {
  const recording = usePracticeRecording({ maxSeconds: SPEED_MAX_SECONDS });
  const isBusy =
    recording.phase === "requesting" || recording.phase === "transcribing";
  const progress = Math.min(
    100,
    (recording.elapsedSeconds / SPEED_MAX_SECONDS) * 100,
  );

  if (recording.phase === "success" && recording.result) {
    const charsPerMinute = recording.result.chars_per_min;
    const score = scoreSpeakingSpeed(charsPerMinute);
    const rangeLeft = positionPercent(SPEAKING_SPEED_RANGE.min);
    const rangeWidth = positionPercent(SPEAKING_SPEED_RANGE.max) - rangeLeft;

    return (
      <section aria-labelledby="speed-result-title" className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 id="speed-result-title" className="text-card font-bold">
            今回の測定結果
          </h2>
          <span className="text-note text-ink-muted">
            結果はこの画面だけに表示され、保存されません
          </span>
        </div>
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex items-baseline gap-2">
            <strong className={`text-[32px] leading-none ${SCORE_TEXT_CLASS[scoreLevel(score)]}`}>
              {formatSpeakingSpeed(charsPerMinute)}
            </strong>
            <span className="text-note text-ink-sub">話速</span>
          </div>
          <div className="flex flex-col gap-2">
            <div
              aria-label={`話速 ${formatSpeakingSpeed(charsPerMinute)}、適正域 ${SPEAKING_SPEED_RANGE.min}〜${SPEAKING_SPEED_RANGE.max} 文字/分`}
              className="relative h-2 rounded-control bg-track"
            >
              <div
                className="absolute h-2 rounded-control bg-[#cfe4e1]"
                style={{ left: `${rangeLeft}%`, width: `${rangeWidth}%` }}
              />
              <div
                className={`absolute -top-1 h-4 w-0.5 ${SCORE_BAR_CLASS[scoreLevel(score)]}`}
                style={{ left: `${positionPercent(charsPerMinute)}%` }}
              />
            </div>
            <p className={`text-note ${SCORE_TEXT_CLASS[scoreLevel(score)]}`}>
              {speakingSpeedComment(charsPerMinute)} 適正域（
              {SPEAKING_SPEED_RANGE.min}〜{SPEAKING_SPEED_RANGE.max} 文字/分）
            </p>
          </div>
        </Card>
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" size="xs" onClick={recording.reset}>
            もう一度測定する
          </Button>
          <PracticeFinishLink />
        </div>
      </section>
    );
  }

  return (
    <>
      <Card className="p-6 text-card leading-[2.2]">
        <p>{passage}</p>
      </Card>
      <section aria-label="録音操作" className="flex flex-col gap-3">
        <div className="flex items-center gap-4">
          {recording.phase === "recording" ? (
            <button
              type="button"
              aria-label="録音を停止する"
              onClick={recording.stopRecording}
              className="grid size-12 flex-none place-items-center rounded-full bg-danger shadow-[0_0_0_5px_#f7e6e5]"
            >
              <span className="block size-3.5 rounded-[3px] bg-white" />
            </button>
          ) : (
            <button
              type="button"
              aria-label="スピード測定の録音を開始する"
              disabled={isBusy}
              onClick={recording.startRecording}
              className="grid size-12 flex-none place-items-center rounded-full bg-accent shadow-[0_0_0_5px_#e4efee] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="block size-3.5 rounded-full bg-white" />
            </button>
          )}
          <div className="flex flex-1 flex-col gap-1.5" aria-live="polite">
            <div
              role="progressbar"
              aria-label="録音時間"
              aria-valuemin={0}
              aria-valuemax={SPEED_MAX_SECONDS}
              aria-valuenow={Math.floor(recording.elapsedSeconds)}
              className="h-[5px] rounded-chip bg-track"
            >
              <div
                className="h-[5px] rounded-chip bg-accent transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-note text-ink-muted">
              {recording.phase === "requesting"
                ? "マイクの使用許可を確認しています"
                : recording.phase === "recording"
                  ? `録音中（${formatElapsed(recording.elapsedSeconds)} / 01:00）— 押すと停止します`
                  : recording.phase === "transcribing"
                    ? "処理中です。文字起こしと評価を計算しています"
                    : "タップで録音を開始します（00:00 / 01:00）"}
            </span>
          </div>
          <PracticeFinishLink />
        </div>
        {recording.error && (
          <div className="flex items-center justify-between gap-4 rounded-control border border-danger/30 bg-danger/5 px-4 py-3">
            <p role="alert" className="text-note text-danger">
              {recording.error.message}
            </p>
            <div className="flex flex-none gap-2">
              {recording.error.kind === "transcription" && (
                <Button variant="secondary" size="xs" onClick={recording.reset}>
                  もう一度録音する
                </Button>
              )}
              <Button size="xs" onClick={recording.retry}>
                {recording.error.kind === "transcription"
                  ? "文字起こしを再試行"
                  : "録音を再試行"}
              </Button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
