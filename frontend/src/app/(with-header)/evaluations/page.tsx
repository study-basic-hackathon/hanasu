"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PageContainer } from "@/components/layout/PageContainer";
import { buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DateTime } from "@/components/ui/DateTime";
import { cn } from "@/lib/cn";
import type { Evaluation } from "@/lib/domain";
import { QUESTION_STRENGTH_LABEL } from "@/lib/domain";
import { deleteEvaluation, listEvaluations } from "@/lib/evaluation-api";
import { formatCount, formatDateTime } from "@/lib/format";
import { SCORE_BAR_CLASS, scoreLevel, scorePercent } from "@/lib/score";

const COLUMNS = "grid-cols-[180px_1fr_110px_300px_120px]";

/** 絞り込みの選択肢。すべて / 企業ごと / チュートリアル（S-16 4章） */
type FilterKey = "all" | "tutorial" | `company:${string}`;

function filterKeyOf(evaluation: Evaluation): FilterKey {
  return evaluation.company_name === null
    ? "tutorial"
    : `company:${evaluation.company_name}`;
}

/** 確認・完了の文面で結果を指し示す言い方（S-16 6.1） */
function evaluationLabel(evaluation: Evaluation): string {
  const target = evaluation.company_name ?? "チュートリアル";
  return `${formatDateTime(evaluation.created_at)} の ${target}`;
}

/** 項目別スコアの3本のバー。数値は出さない（S-16 5章） */
function ScoreBars({ evaluation }: { evaluation: Evaluation }) {
  const scores = evaluation.scores;
  if (!scores) return null;

  const values = [
    scores.speaking_speed?.score ?? null,
    scores.filler?.score ?? null,
    scores.structure_content.score,
  ];

  return (
    <div className="flex items-center gap-2">
      {values.map((score, index) => (
        <div key={index} className="h-1.5 flex-1 rounded-chip bg-track">
          {score !== null && (
            <div
              className={cn("h-1.5 rounded-chip", SCORE_BAR_CLASS[scoreLevel(score)])}
              style={{ width: `${scorePercent(score)}%` }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/** 総合スコアの列。評価が終わっていない結果の表示を含む（S-16 5.1） */
function TotalScoreCell({ evaluation }: { evaluation: Evaluation }) {
  if (evaluation.status === "processing") {
    return <span className="text-label text-ink-sub">評価中</span>;
  }
  if (evaluation.status === "failed") {
    return <span className="text-label text-danger">失敗</span>;
  }
  return (
    <span className="text-[18px] font-bold">{evaluation.total_score}</span>
  );
}

/**
 * S-16 履歴一覧。
 * 評価結果の取得 API は全件を返すため、並び替えと絞り込みは画面側で行う。
 */
export default function EvaluationsPage() {
  const [newestFirst, setNewestFirst] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Evaluation | null>(null);
  const [deleting, setDeleting] = useState(false);
  // 削除の失敗・完了は読み込みの error とは別に持つ。error は画面ごと差し替えるため流用できない
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletedLabel, setDeletedLabel] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    listEvaluations(controller.signal)
      .then((loaded) => {
        setEvaluations(loaded);
        setLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError("評価履歴を取得できませんでした。時間をおいて再読み込みしてください。");
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, []);

  const total = evaluations.length;

  // 結果が1件以上ある企業だけを選択肢に出す（S-16 4章）
  const companyOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const evaluation of evaluations) {
      if (evaluation.company_name === null) continue;
      counts.set(
        evaluation.company_name,
        (counts.get(evaluation.company_name) ?? 0) + 1,
      );
    }
    return [...counts.entries()].map(([companyName, count]) => ({
      key: `company:${companyName}` as FilterKey,
      label: companyName,
      count,
    }));
  }, [evaluations]);

  const tutorialCount = evaluations.filter(
    (evaluation) => evaluation.company_name === null,
  ).length;

  const rows = useMemo(() => {
    const filtered =
      filter === "all"
        ? [...evaluations]
        : evaluations.filter(
            (evaluation) => filterKeyOf(evaluation) === filter,
          );
    // 実施日時で並べる。ページ送りは持たず全件を縦に並べる（S-16 3章）
    return filtered.sort((a, b) =>
      newestFirst
        ? b.created_at.localeCompare(a.created_at)
        : a.created_at.localeCompare(b.created_at),
    );
  }, [evaluations, filter, newestFirst]);

  async function handleDelete() {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteEvaluation(pendingDelete.evaluation_id);
      const remaining = evaluations.filter(
        (evaluation) => evaluation.evaluation_id !== pendingDelete.evaluation_id,
      );
      // 一覧は画面側で除くだけにして API は呼び直さない（S-16 6章）
      setEvaluations(remaining);
      // 絞り込み中の企業の最後の1件だったら選択肢ごと消えるので、すべての企業に戻す（S-16 4章）
      if (
        filter !== "all" &&
        !remaining.some((evaluation) => filterKeyOf(evaluation) === filter)
      ) {
        setFilter("all");
      }
      setDeletedLabel(evaluationLabel(pendingDelete));
    } catch {
      setDeleteError("削除できませんでした。時間をおいてもう一度お試しください。");
    } finally {
      // 失敗しても閉じる。開いたままだと一覧の上の赤字が backdrop に隠れる（共通仕様 7.2）
      setPendingDelete(null);
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <PageContainer width={1080} className="text-body-sm text-ink-sub">
        評価履歴を読み込んでいます。
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer width={1080}>
        <p role="alert" className="rounded-control border border-danger/30 bg-danger/5 px-4 py-3 text-body-sm text-danger">
          {error}
        </p>
      </PageContainer>
    );
  }

  return (
    <PageContainer width={1080} className="flex flex-col gap-5">
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-heading font-bold">履歴</h1>
          <p className="text-label text-ink-sub">
            {filter === "all"
              ? `全 ${total} 件。チュートリアルの結果も含みます。`
              : `${formatCount(rows.length)}を表示しています（全 ${total} 件）。`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setNewestFirst((current) => !current)}
          className="rounded-control border border-line-strong bg-surface px-3 py-2 text-label hover:bg-canvas"
        >
          {newestFirst ? "新しい順" : "古い順"}
        </button>
      </div>

      <div className="flex items-center gap-2.5">
        <label htmlFor="company-filter" className="text-label text-ink-sub">
          表示する企業
        </label>
        <select
          id="company-filter"
          value={filter}
          onChange={(event) => setFilter(event.target.value as FilterKey)}
          className="h-[38px] w-[300px] rounded-control border border-line-strong bg-surface px-3 text-body-sm"
        >
          <option value="all">すべての企業（{formatCount(total)}）</option>
          {companyOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}（{formatCount(option.count)}）
            </option>
          ))}
          {/* チュートリアルは区切って最後に置く（S-16 4章） */}
          {tutorialCount > 0 && (
            <optgroup label="&#8212;">
              <option value="tutorial">
                チュートリアル（{formatCount(tutorialCount)}）
              </option>
            </optgroup>
          )}
        </select>
      </div>

      {/* 削除の結果は一覧カードの上部に出す（共通仕様 7.2 / S-16 6.1） */}
      {deletedLabel && (
        <p className="rounded-control border border-accent/30 bg-accent-soft px-4 py-3 text-body-sm text-accent">
          {deletedLabel} の結果を削除しました。
        </p>
      )}

      {deleteError && (
        <p
          role="alert"
          className="rounded-control border border-danger/30 bg-danger/5 px-4 py-3 text-body-sm text-danger"
        >
          {deleteError}
        </p>
      )}

      {total === 0 ? (
        <Card className="flex flex-col items-start gap-5 px-6 py-10">
          <p className="text-body-sm text-ink-sub">
            まだ結果がありません。練習かチュートリアルを始めると、ここに結果が並びます。
          </p>
          <Link
            href="/"
            className={buttonClassName("primary", "sm")}
          >
            面接・練習を始める
          </Link>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="px-6 py-10">
          <p className="text-body-sm text-ink-sub">
            この企業の結果はまだありません。
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div
            className={`grid ${COLUMNS} border-b border-line bg-[#fafbfb] px-6 py-3 text-note font-medium text-ink-sub`}
          >
            <span>実施日時</span>
            <span>対象企業 / 種別</span>
            <span>総合スコア</span>
            <span>項目別（速さ / フィラー / 構成）</span>
            <span className="text-right">操作</span>
          </div>
          {rows.map((evaluation) => (
            <div
              key={evaluation.evaluation_id}
              data-evaluation-id={evaluation.evaluation_id}
              className={`relative grid ${COLUMNS} items-center border-b border-divider px-6 py-4 text-body-sm last:border-b-0 hover:bg-accent-soft`}
            >
              <DateTime
                value={evaluation.created_at}
                className="text-ink-label"
              />
              <div className="flex flex-col gap-[3px]">
                <span
                  className={cn(
                    "font-medium",
                    evaluation.company_name === null && "text-ink-sub",
                  )}
                >
                  {evaluation.company_name ?? "（企業なし）"}
                </span>
                <span className="text-note text-ink-muted">
                  {evaluation.company_name === null
                    ? "チュートリアル"
                    : `本番モード / 強度 ${
                        evaluation.question_strength
                          ? QUESTION_STRENGTH_LABEL[evaluation.question_strength]
                          : "—"
                      }`}
                </span>
              </div>
              <TotalScoreCell evaluation={evaluation} />
              <ScoreBars evaluation={evaluation} />
              <div className="flex items-center justify-end gap-3.5 text-label">
                {/* 擬似要素で行全体を覆い、行のどこを押しても開けるようにする（S-16 6章） */}
                <Link
                  href={`/evaluations/detail?id=${evaluation.evaluation_id}`}
                  className="text-accent after:absolute after:inset-0 after:content-['']"
                >
                  開く
                </Link>
                {/* 削除は行のリンクより手前に重ね、押しても S-14 へ遷移させない（S-16 6.1） */}
                <button
                  type="button"
                  aria-label={`${evaluationLabel(evaluation)} の結果を削除`}
                  onClick={() => {
                    setDeletedLabel(null);
                    setDeleteError(null);
                    setPendingDelete(evaluation);
                  }}
                  className="relative z-10 text-danger hover:underline"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        message={
          pendingDelete
            ? `${evaluationLabel(pendingDelete)} の結果を削除します。元に戻せません。`
            : ""
        }
        confirmLabel="削除する"
        busy={deleting}
        busyLabel="削除しています"
        onConfirm={handleDelete}
        onCancel={() => !deleting && setPendingDelete(null)}
      />
    </PageContainer>
  );
}
