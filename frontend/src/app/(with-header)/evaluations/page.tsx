"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { PageContainer } from "@/components/layout/PageContainer";
import { buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DateTime } from "@/components/ui/DateTime";
import { cn } from "@/lib/cn";
import { formatCount } from "@/lib/format";
import { SCORE_BAR_CLASS, scoreLevel, scorePercent } from "@/lib/score";
import { MOCK_APPLICATIONS } from "@/mocks/applications";
import { MOCK_EVALUATIONS } from "@/mocks/evaluations";
import type { Evaluation } from "@/mocks/types";
import { QUESTION_STRENGTH_LABEL } from "@/mocks/types";

const COLUMNS = "grid-cols-[180px_1fr_110px_320px_90px]";

/** 絞り込みの選択肢。すべて / 企業ごと / チュートリアル（S-16 4章） */
type FilterKey = "all" | "tutorial" | `company-${number}`;

function filterKeyOf(evaluation: Evaluation): FilterKey {
  return evaluation.company_id === null
    ? "tutorial"
    : `company-${evaluation.company_id}`;
}

/** 項目別スコアの3本のバー。数値は出さない（S-16 5章） */
function ScoreBars({ evaluation }: { evaluation: Evaluation }) {
  const scores = evaluation.scores;
  if (!scores) return null;

  const values = [
    scores.speaking_speed.score,
    scores.filler.score,
    scores.structure_content.score,
  ];

  return (
    <div className="flex items-center gap-2">
      {values.map((score, index) => (
        <div key={index} className="h-1.5 flex-1 rounded-chip bg-track">
          <div
            className={cn("h-1.5 rounded-chip", SCORE_BAR_CLASS[scoreLevel(score)])}
            style={{ width: `${scorePercent(score)}%` }}
          />
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

  const total = MOCK_EVALUATIONS.length;

  // 結果が1件以上ある企業だけを選択肢に出す（S-16 4章）
  const companyOptions = useMemo(() => {
    const counts = new Map<number, number>();
    for (const evaluation of MOCK_EVALUATIONS) {
      if (evaluation.company_id === null) continue;
      counts.set(
        evaluation.company_id,
        (counts.get(evaluation.company_id) ?? 0) + 1,
      );
    }
    return [...counts.entries()].map(([companyId, count]) => {
      const application = MOCK_APPLICATIONS.find(
        (candidate) => candidate.id === companyId,
      );
      return {
        key: `company-${companyId}` as FilterKey,
        // 削除済みの企業の結果も残る（S-16 4章）
        label: application?.company_name ?? "（削除済みの企業）",
        count,
      };
    });
  }, []);

  const tutorialCount = MOCK_EVALUATIONS.filter(
    (evaluation) => evaluation.company_id === null,
  ).length;

  const rows = useMemo(() => {
    const filtered =
      filter === "all"
        ? [...MOCK_EVALUATIONS]
        : MOCK_EVALUATIONS.filter(
            (evaluation) => filterKeyOf(evaluation) === filter,
          );
    // 実施日時で並べる。ページ送りは持たず全件を縦に並べる（S-16 3章）
    return filtered.sort((a, b) =>
      newestFirst
        ? b.created_at.localeCompare(a.created_at)
        : a.created_at.localeCompare(b.created_at),
    );
  }, [filter, newestFirst]);

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

      {total === 0 ? (
        <Card className="flex flex-col items-start gap-5 px-6 py-10">
          <p className="text-body-sm text-ink-sub">
            まだ結果がありません。練習かチュートリアルを始めると、ここに結果が並びます。
          </p>
          <Link
            href="/practice/setup"
            className={buttonClassName("primary", "sm")}
          >
            練習を始める
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
            <span />
          </div>
          {rows.map((evaluation) => (
            <Link
              key={evaluation.evaluation_id}
              href={`/evaluations/${evaluation.evaluation_id}`}
              className={`grid ${COLUMNS} items-center border-b border-divider px-6 py-4 text-body-sm last:border-b-0 hover:bg-accent-soft`}
            >
              <DateTime
                value={evaluation.created_at}
                className="text-ink-label"
              />
              <div className="flex flex-col gap-[3px]">
                <span
                  className={cn(
                    "font-medium",
                    evaluation.company_id === null && "text-ink-sub",
                  )}
                >
                  {evaluation.company_name ?? "（企業なし）"}
                </span>
                <span className="text-note text-ink-muted">
                  {evaluation.company_id === null
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
              <span className="text-right text-label text-accent">開く</span>
            </Link>
          ))}
        </Card>
      )}
    </PageContainer>
  );
}
