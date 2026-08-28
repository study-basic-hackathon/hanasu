"use client";

import { PracticeFinishLink } from "@/components/practice/PracticeSubLayout";
import { usePracticeRecording } from "@/components/practice/usePracticeRecording";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatElapsed, formatFiller, formatSpeakingSpeed } from "@/lib/format";
import {
  SCORE_TEXT_CLASS,
  SPEAKING_SPEED_RANGE,
  scoreFillerRate,
  scoreLevel,
  scoreSpeakingSpeed,
} from "@/lib/score";

export const READING_MAX_SECONDS = 60;

type ReadingPracticeSessionProps = {
  passage: string;
};

function speakingSpeedComment(charsPerMinute: number): string {
  if (charsPerMinute < SPEAKING_SPEED_RANGE.min) {
    return "少しゆっくりです。文のまとまりを意識してテンポを上げましょう。";
  }
  if (charsPerMinute > SPEAKING_SPEED_RANGE.max) {
    return "少し速めです。句読点で間を取り、落ち着いて読みましょう。";
  }
  return "適正な話速です。このテンポを保ちましょう。";
}

function fillerComment(fillersPerMinute: number): string {
  const level = scoreLevel(scoreFillerRate(fillersPerMinute));
  if (level === "good") return "フィラーを抑えて話せています。";
  if (level === "caution") {
    return "言葉を探すときは、フィラーの代わりに短く間を取りましょう。";
  }
  return "一文ずつ区切り、フィラーの代わりに息を整えましょう。";
}

function MetricCard({
  label,
  value,
  score,
  comment,
}: {
  label: string;
  value: string;
  score: number;
  comment: string;
}) {
  const level = scoreLevel(score);
  return (
    <Card className="flex flex-1 flex-col gap-2.5 p-5">
      <span className="text-label text-ink-sub">{label}</span>
      <strong className={`text-[26px] leading-none ${SCORE_TEXT_CLASS[level]}`}>
        {value}
      </strong>
      <p className="text-note leading-[1.7] text-ink-sub">{comment}</p>
    </Card>
  );
}

/** S-10 の録音・一時評価UI。静的な画面骨格からClient境界を狭く保つ。 */
export function ReadingPracticeSession({ passage }: ReadingPracticeSessionProps) {
  const recording = usePracticeRecording({ maxSeconds: READING_MAX_SECONDS });
  const isBusy =
    recording.phase === "requesting" || recording.phase === "transcribing";
  const progress = Math.min(
    100,
    (recording.elapsedSeconds / READING_MAX_SECONDS) * 100,
  );

  return (
    <>
      <Card className="p-6 text-card leading-[2.2]">
        <p>{passage}</p>
      </Card>

      {recording.phase === "success" && recording.result ? (
        <section aria-labelledby="reading-result-title" className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 id="reading-result-title" className="text-card font-bold">
              今回の評価
            </h2>
            <span className="text-note text-ink-muted">
              結果はこの画面だけに表示され、保存されません
            </span>
          </div>
          <div className="flex gap-4">
            <MetricCard
              label="話速"
              value={formatSpeakingSpeed(recording.result.chars_per_min)}
              score={scoreSpeakingSpeed(recording.result.chars_per_min)}
              comment={speakingSpeedComment(recording.result.chars_per_min)}
            />
            <MetricCard
              label="フィラー"
              value={formatFiller(recording.result.filler_count_per_min)}
              score={scoreFillerRate(recording.result.filler_count_per_min)}
              comment={fillerComment(recording.result.filler_count_per_min)}
            />
          </div>
          <div className="flex justify-end gap-2.5">
            <Button variant="secondary" size="xs" onClick={recording.reset}>
              もう一度練習する
            </Button>
            <PracticeFinishLink />
          </div>
        </section>
      ) : (
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
                aria-label="音読の録音を開始する"
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
                aria-valuemax={READING_MAX_SECONDS}
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
      )}
    </>
  );
}
