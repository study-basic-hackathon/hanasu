"use client";

import Link from "next/link";

import { PageContainer } from "@/components/layout/PageContainer";
import { Button, buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import type { Evaluation } from "@/lib/domain";
import { QUESTION_STRENGTH_LABEL } from "@/lib/domain";
import { formatFiller, formatSpeakingSpeed } from "@/lib/format";
import {
  SCORE_TEXT_CLASS,
  SPEAKING_SPEED_RANGE,
  scoreLevel,
  scorePercent,
  SCORE_BAR_CLASS,
} from "@/lib/score";

type EvaluationViewProps = {
  evaluation: Evaluation;
  /** S-08 から続けて開いたか。失敗したときの導線が変わる（S-14 5章） */
  fromInterview: boolean;
  onRetry?: () => void;
};

/** 合否の目安（S-14 4.2）。しきい値はスコアの色分けと同じ */
function passLabel(totalScore: number): string {
  if (totalScore >= 65) return "通過見込み";
  if (totalScore >= 45) return "あと一歩";
  return "練習が必要";
}

/** 話の速さの補足は、実測値と適正域から画面が組み立てる（S-14 4.3） */
function speedComment(value: number): string {
  const { min, max } = SPEAKING_SPEED_RANGE;
  const range = `適正域は ${min}〜${max} 文字/分。`;
  if (value < min - 30) return `${range}かなり遅く、間延びして聞こえます。`;
  if (value < min) return `${range}やや遅めですが許容範囲です。`;
  if (value <= max) return `${range}適正な速さです。`;
  if (value <= max + 30) return `${range}やや速めです。`;
  return `${range}速すぎるため聞き取りにくくなります。`;
}

export function EvaluationView({
  evaluation,
  fromInterview,
  onRetry,
}: EvaluationViewProps) {
  if (evaluation.status === "processing") return <ProcessingCard />;
  if (evaluation.status === "failed") {
    return (
      <FailedCard
        fromInterview={fromInterview && onRetry !== undefined}
        onRetry={onRetry}
      />
    );
  }
  return <ResultView evaluation={evaluation} />;
}

/** 処理中（S-14 3章） */
function ProcessingCard() {
  return (
    <PageContainer width={1080} className="grid place-items-center">
      <Card className="flex w-[440px] flex-col items-center gap-4 px-10 py-[34px]">
        <div
          className="grid size-14 animate-spin place-items-center rounded-full"
          style={{
            background:
              "conic-gradient(var(--color-accent) 0turn 0.3turn, var(--color-track) 0.3turn 1turn)",
          }}
        >
          <span className="block size-[42px] rounded-full bg-surface" />
        </div>
        <h1 className="text-card font-bold">評価しています</h1>
        <p className="text-center text-label leading-[1.9] text-ink-sub">
          会話全体を読み込んで評価を作成中です。1分ほどかかります。
          <br />
          この画面を開いたままお待ちください。
        </p>
        <div className="h-[5px] w-full rounded-chip bg-track">
          <div className="h-[5px] w-[34%] rounded-chip bg-accent" />
        </div>
      </Card>
    </PageContainer>
  );
}

/** 失敗（S-14 5章） */
function FailedCard({
  fromInterview,
  onRetry,
}: {
  fromInterview: boolean;
  onRetry?: () => void;
}) {
  return (
    <PageContainer width={1080} className="grid place-items-center">
      <Card className="flex w-[440px] flex-col items-center gap-4 px-10 py-[34px]">
        <div className="grid size-14 place-items-center rounded-full border-2 border-danger text-2xl font-bold text-danger">
          !
        </div>
        <h1 className="text-card font-bold">評価に失敗しました</h1>
        <p className="text-center text-label leading-[1.9] text-ink-sub">
          {fromInterview
            ? "会話の内容は保存されています。もう一度評価を実行できます。"
            : "この結果は取得できませんでした。"}
        </p>
        <div className="flex w-full gap-2.5">
          {/* 会話履歴を持つのは S-08 から続けて開いたときだけ */}
          {fromInterview ? (
            <>
              <Button size="xs" className="h-10 flex-1" onClick={onRetry}>
                評価をやり直す
              </Button>
              <Link
                href="/"
                className={buttonClassName("secondary", "xs", "h-10 flex-1")}
              >
                ホームに戻る
              </Link>
            </>
          ) : (
            <Link
              href="/evaluations"
              className={buttonClassName("secondary", "xs", "h-10 flex-1")}
            >
              履歴に戻る
            </Link>
          )}
        </div>
      </Card>
    </PageContainer>
  );
}

/** 結果（S-14 4章） */
function ResultView({ evaluation }: { evaluation: Evaluation }) {
  const scores = evaluation.scores;
  const totalScore = evaluation.total_score;
  if (!scores || totalScore === null) return <ProcessingCard />;
  const filler = scores.filler;

  const isTutorial = evaluation.company_id === null;
  const conditions = isTutorial
    ? `チュートリアル / ${evaluation.turn_count ?? "—"} ターン`
    : `${evaluation.company_name} / 強度 ${
        evaluation.question_strength
          ? QUESTION_STRENGTH_LABEL[evaluation.question_strength]
          : "—"
      } / ${evaluation.turn_count ?? "—"} ターン`;

  return (
    <PageContainer width={1080} className="flex flex-col gap-5">
      <div className="flex items-center justify-between rounded-card bg-ink px-[30px] py-[26px] text-white">
        <div className="flex items-center gap-6">
          {/* 総合スコアには色をつけない（共通仕様 9章） */}
          <div
            className="grid size-24 flex-none place-items-center rounded-full"
            style={{
              background: `conic-gradient(#3fbfae 0turn ${scorePercent(totalScore) / 100}turn, #33393e ${scorePercent(totalScore) / 100}turn 1turn)`,
            }}
          >
            <div className="grid size-[76px] place-items-center rounded-full bg-ink text-score-total font-bold">
              {totalScore}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-label text-[#a6aeb4]">総合スコア</span>
            <h1 className="text-[17px] font-bold">
              合否の目安：{passLabel(totalScore)}
            </h1>
            <span className="text-label text-[#a6aeb4]">{conditions}</span>
          </div>
        </div>
        <div className="flex gap-2.5">
          <Link
            href="/practice/setup?mode=interview"
            className="grid h-10 place-items-center rounded-control bg-surface px-5 text-body-sm font-medium text-ink hover:bg-surface/90"
          >
            再挑戦する
          </Link>
          <Link
            href="/evaluations"
            className="grid h-10 place-items-center rounded-control border border-[#4a5257] px-[18px] text-body-sm hover:bg-white/5"
          >
            履歴
          </Link>
          <Link
            href="/"
            className="grid h-10 place-items-center rounded-control border border-[#4a5257] px-[18px] text-body-sm hover:bg-white/5"
          >
            ホームに戻る
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {scores.speaking_speed ? (
          <ScoreCard
            label="話の速さ"
            score={scores.speaking_speed.score}
            measured={formatSpeakingSpeed(scores.speaking_speed.value)}
            note={speedComment(scores.speaking_speed.value)}
          />
        ) : (
          <UnmeasuredScoreCard label="話の速さ" />
        )}
        {/* フィラーの数は補足を持たない（S-14 4.3） */}
        {filler?.value_per_minute !== undefined ? (
          <ScoreCard
            label="フィラーの数"
            score={filler.score}
            measured={formatFiller(filler.value_per_minute)}
          />
        ) : (
          <UnmeasuredScoreCard label="フィラーの数" />
        )}
        <ScoreCard
          label="構成・内容"
          score={scores.structure_content.score}
          measured="AI 評価"
          note={scores.structure_content.comment}
        />
      </div>

      <Card className="flex flex-col gap-3 px-[26px] py-6">
        <h2 className="text-card-sm font-bold">アドバイス</h2>
        {evaluation.advice.map((sentence, index) => (
          <p key={index} className="text-body-sm leading-[2] text-ink-label">
            {sentence}
          </p>
        ))}
      </Card>

      <p className="text-note leading-[1.8] text-ink-muted">
        合否の目安は本サービス内の参考値であり、実際の選考結果とは関係ありません。
      </p>
    </PageContainer>
  );
}

function UnmeasuredScoreCard({ label }: { label: string }) {
  return (
    <Card className="flex flex-col gap-3.5 p-6">
      <span className="text-label text-ink-sub">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className="text-score-item leading-none font-bold text-ink-muted">
          —
        </span>
        <span className="text-label text-ink-muted">計測対象外</span>
      </div>
      <div className="h-2 rounded-control bg-track" />
      <p className="text-note leading-[1.8] text-ink-muted">
        計測できる音声回答がありません。
      </p>
    </Card>
  );
}

/** 項目別スコアのカード（S-14 4.3） */
function ScoreCard({
  label,
  score,
  measured,
  note,
}: {
  label: string;
  score: number;
  measured: string;
  note?: string;
}) {
  const level = scoreLevel(score);

  return (
    <Card className="flex flex-col gap-3.5 p-6">
      <span className="text-label text-ink-sub">{label}</span>
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            "text-score-item leading-none font-bold",
            SCORE_TEXT_CLASS[level],
          )}
        >
          {score}
        </span>
        <span className="text-label text-ink-muted">{measured}</span>
      </div>
      <div className="h-2 rounded-control bg-track">
        <div
          className={cn("h-2 rounded-control", SCORE_BAR_CLASS[level])}
          style={{ width: `${scorePercent(score)}%` }}
        />
      </div>
      {note && (
        <p className="text-note leading-[1.8] text-ink-muted">{note}</p>
      )}
    </Card>
  );
}
