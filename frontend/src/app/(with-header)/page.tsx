"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { TutorialStartDialog } from "@/components/interview/TutorialStartDialog";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button, buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DateTime } from "@/components/ui/DateTime";
import { ScoreBar } from "@/components/ui/ScoreBar";
import { listCompanies } from "@/lib/company-api";
import type { Evaluation } from "@/lib/domain";
import {
  ANSWER_METHOD_LABEL,
  QUESTION_STRENGTH_LABEL,
} from "@/lib/domain";
import { listEvaluations } from "@/lib/evaluation-api";
import { DEFAULT_READ_ALOUD_MODE } from "@/lib/interview";
import { formatCount, formatFiller, formatSpeakingSpeed } from "@/lib/format";
import { SCORE_TEXT_CLASS, scoreLevel, scorePercent } from "@/lib/score";

/** 総合スコアの円。円の内側に数値、その下に `総合スコア`（S-04 3.2） */
function TotalScoreCircle({ score }: { score: number }) {
  return (
    <div
      className="grid size-[138px] flex-none place-items-center rounded-full"
      style={{
        background: `conic-gradient(var(--color-accent) 0turn ${scorePercent(score) / 100}turn, var(--color-track) ${scorePercent(score) / 100}turn 1turn)`,
      }}
    >
      <div className="flex size-[108px] flex-col items-center justify-center gap-px rounded-full bg-surface">
        {/* 総合スコアには色をつけない（共通仕様 9章） */}
        <div className="text-[34px] leading-none font-bold">{score}</div>
        <div className="text-[10px] text-ink-muted">総合スコア</div>
      </div>
    </div>
  );
}

/** 項目別スコアの1行（ラベル・スコア・実測値・バー） */
function ScoreRow({
  label,
  score,
  measured,
}: {
  label: string;
  score: number | null;
  measured?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-label">
        <span className="text-ink-label">{label}</span>
        <span
          className={
            score === null
              ? "text-ink-muted"
              : SCORE_TEXT_CLASS[scoreLevel(score)]
          }
        >
          {score ?? "—"}
          {measured && (
            <span className="text-ink-muted"> / {measured}</span>
          )}
        </span>
      </div>
      {score === null ? (
        <div className="h-1.5 rounded-control bg-track" />
      ) : (
        <ScoreBar score={score} />
      )}
    </div>
  );
}

/** 直近の評価結果（S-04 3.2） */
function LatestEvaluationCard({ evaluation }: { evaluation: Evaluation }) {
  const scores = evaluation.scores;
  if (!scores || evaluation.total_score === null) return null;
  const filler = scores.filler;

  return (
    <Card className="flex flex-col gap-[22px] px-7 py-[26px]">
      <div className="flex items-baseline justify-between">
        <h2 className="text-body font-bold">直近の評価結果</h2>
        <Link
          href={`/evaluations/detail?id=${evaluation.evaluation_id}`}
          className="text-label text-accent hover:underline"
        >
          詳細を見る
        </Link>
      </div>
      <div className="flex items-center gap-9">
        <TotalScoreCircle score={evaluation.total_score} />
        <div className="flex flex-1 flex-col gap-4">
          <ScoreRow
            label="話の速さ"
            score={scores.speaking_speed?.score ?? null}
            measured={
              scores.speaking_speed
                ? formatSpeakingSpeed(scores.speaking_speed.value)
                : "計測対象外"
            }
          />
          <ScoreRow
            label="フィラーの数"
            score={
              filler?.value_per_minute !== undefined ? filler.score : null
            }
            measured={
              filler?.value_per_minute !== undefined
                ? formatFiller(filler.value_per_minute)
                : "計測対象外"
            }
          />
          <ScoreRow
            label="構成・内容"
            score={scores.structure_content.score}
          />
        </div>
      </div>
      {/* 実施条件。チュートリアルの結果では企業と強度を持たない */}
      <div className="flex gap-6 border-t border-divider pt-4 text-label text-ink-sub">
        <span>対象企業：{evaluation.company_name ?? "（企業なし）"}</span>
        <span>
          質問の強度：
          {evaluation.question_strength
            ? QUESTION_STRENGTH_LABEL[evaluation.question_strength]
            : "—"}
        </span>
        <span>
          回答方式：
          {evaluation.answer_method
            ? ANSWER_METHOD_LABEL[evaluation.answer_method]
            : "—"}
        </span>
      </div>
    </Card>
  );
}

/** 評価結果が0件のとき（S-04 5章） */
function EmptyEvaluationCard() {
  return (
    <Card className="flex flex-col gap-[22px] px-7 py-[26px]">
      <h2 className="text-body font-bold">直近の評価結果</h2>
      <p className="text-label leading-[1.9] text-ink-sub">
        まだ結果がありません。練習かチュートリアルを始めると、ここに結果が出ます。
      </p>
    </Card>
  );
}

/** 応募企業情報 / 履歴の小さなカード（S-04 3.5） */
function SummaryCard({
  title,
  description,
  linkLabel,
  href,
}: {
  title: string;
  description: string;
  linkLabel: string;
  href: string;
}) {
  return (
    <Card className="flex items-center justify-between px-6 py-[22px]">
      <div className="flex flex-col gap-[5px]">
        <h2 className="text-body font-bold">{title}</h2>
        <p className="text-label text-ink-sub">{description}</p>
      </div>
      <Link href={href} className="text-label text-accent hover:underline">
        {linkLabel}
      </Link>
    </Card>
  );
}

export default function HomePage() {
  const [applicationCount, setApplicationCount] = useState(0);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingTutorial, setStartingTutorial] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      listCompanies(controller.signal),
      listEvaluations(controller.signal),
    ])
      .then(([companies, loadedEvaluations]) => {
        setApplicationCount(companies.length);
        setEvaluations(loadedEvaluations);
        setLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError("ホームの情報を取得できませんでした。時間をおいて再読み込みしてください。");
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, []);

  // 評価結果は全件が返り、直近1件の抽出と件数の算出は画面側で行う（S-04 6章）。
  // 評価が終わっていない結果はスコアを持たないため、完了したものから最も新しい1件を採る
  const latest = evaluations.filter(
    (evaluation) => evaluation.status === "completed",
  ).reduce<Evaluation | null>(
    (newest, evaluation) =>
      newest === null || evaluation.created_at > newest.created_at
        ? evaluation
        : newest,
    null,
  );
  const evaluationCount = evaluations.length;

  if (loading) {
    return (
      <PageContainer width={1200} className="text-body-sm text-ink-sub">
        ホームの情報を読み込んでいます。
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer width={1200}>
        <p role="alert" className="rounded-control border border-danger/30 bg-danger/5 px-4 py-3 text-body-sm text-danger">
          {error}
        </p>
      </PageContainer>
    );
  }

  return (
    <PageContainer width={1200} className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-heading font-bold">ホーム</h1>
        {/* 最終実施日時。結果が0件のときは表示しない（S-04 3.1） */}
        {latest && (
          <span className="text-label text-ink-muted">
            最終実施 <DateTime value={latest.created_at} />
          </span>
        )}
      </div>

      <div className="grid grid-cols-[1fr_380px] gap-6">
        {latest ? (
          <LatestEvaluationCard evaluation={latest} />
        ) : (
          <EmptyEvaluationCard />
        )}

        <div className="flex flex-col gap-6">
          {/* モードを決めてから S-05 へ進む主導線（S-04 3.3） */}
          <div className="flex flex-col gap-3.5 rounded-card bg-accent p-[26px] text-white">
            <h2 className="text-card font-bold">面接・練習を始める</h2>
            <p className="text-label leading-[1.8] text-[#cde5e2]">
              取り組むモードを選んで、設定へ進みます。
            </p>
            <div className="mt-1 flex flex-col gap-2.5">
              <Link
                href="/practice/setup?mode=interview"
                className={buttonClassName("onAccent", "md", "w-full")}
              >
                本番モードを始める
              </Link>
              <Link
                href="/practice/setup?mode=practice"
                className="inline-flex h-btn w-full items-center justify-center rounded-control border border-white/70 px-5 text-body font-medium whitespace-nowrap text-white transition-colors hover:bg-white/10"
              >
                練習モードを始める
              </Link>
            </div>
          </div>

          {/* 登録件数にかかわらず常に表示する（S-04 3.4） */}
          <Card className="flex flex-col gap-3 p-6">
            <h2 className="text-body font-bold">チュートリアル</h2>
            <p className="text-label leading-[1.8] text-ink-sub">
              「1分で自己紹介してください」の1問だけ。応募企業情報の登録なしで試せます。
            </p>
            {/* 回答方式と読み上げモードを1回確認してから S-03 へ進む */}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setStartingTutorial(true)}
            >
              試してみる
            </Button>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {applicationCount > 0 ? (
          <SummaryCard
            title="応募企業情報"
            description={`${formatCount(applicationCount)}登録済み`}
            linkLabel="一覧を見る"
            href="/companies"
          />
        ) : (
          <SummaryCard
            title="応募企業情報"
            description="まだ登録がありません"
            linkLabel="登録する"
            href="/companies/new"
          />
        )}
        <SummaryCard
          title="履歴"
          description={`${formatCount(evaluationCount)}の評価結果`}
          linkLabel="履歴を見る"
          href="/evaluations"
        />
      </div>

      <TutorialStartDialog
        open={startingTutorial}
        defaultAnswerMethod="voice"
        defaultReadAloudMode={DEFAULT_READ_ALOUD_MODE}
        onCancel={() => setStartingTutorial(false)}
      />
    </PageContainer>
  );
}
