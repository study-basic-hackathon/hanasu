"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { PageContainer } from "@/components/layout/PageContainer";
import { Button, buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { filledSections } from "@/lib/application";
import { cn } from "@/lib/cn";
import { listCompanies, type Company } from "@/lib/company-api";
import type {
  AnswerMethod,
  QuestionStrength,
  ReadAloudMode,
} from "@/lib/domain";
import {
  ANSWER_METHOD_LABEL,
  QUESTION_STRENGTH_LABEL,
  READ_ALOUD_MODE_LABEL,
} from "@/lib/domain";
import {
  DEFAULT_MAX_TURNS,
  DEFAULT_READ_ALOUD_MODE,
  MAX_MAX_TURNS,
  MIN_MAX_TURNS,
  parseMaxTurns,
} from "@/lib/interview";

type Mode = "interview" | "practice";

const STRENGTHS: QuestionStrength[] = ["easy", "standard", "hard"];
const ANSWER_METHODS: AnswerMethod[] = ["voice", "text"];
const READ_ALOUD_MODES: ReadAloudMode[] = ["enabled", "disabled"];

/** 選択の丸。選択中はアクセント色で塗る */
function RadioMark({ selected }: { selected: boolean }) {
  return (
    <span
      className={cn(
        "block size-4 flex-none rounded-full bg-surface",
        selected ? "border-[5px] border-accent" : "border border-[#c3c9ce]",
      )}
    />
  );
}

/**
 * S-05 本番・練習モードの設定。
 * 選んだ内容はサーバーに保存せず、S-08 / S-09 へ引き渡す（ADR-0008）。
 * 本番モードの選択内容はクエリ文字列で S-08 へ引き渡す。
 */
export default function PracticeSetupPage() {
  return (
    <Suspense
      fallback={
        <PageContainer width={960} className="text-body-sm text-ink-sub">
          設定を読み込んでいます。
        </PageContainer>
      }
    >
      <PracticeSetupContent />
    </Suspense>
  );
}

function PracticeSetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modeValues = searchParams.getAll("mode");
  const modeValue = modeValues.length === 1 ? modeValues[0] : null;
  const mode: Mode | null =
    modeValue === "interview" || modeValue === "practice"
      ? modeValue
      : null;
  const [answerMethod, setAnswerMethod] = useState<AnswerMethod>("voice");
  const [readAloudMode, setReadAloudMode] = useState<ReadAloudMode>(
    DEFAULT_READ_ALOUD_MODE,
  );
  const [strength, setStrength] = useState<QuestionStrength>("standard");
  const [maxTurnsInput, setMaxTurnsInput] = useState(
    String(DEFAULT_MAX_TURNS),
  );
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === null) router.replace("/");
  }, [mode, router]);

  useEffect(() => {
    if (mode === null) return;
    const controller = new AbortController();
    listCompanies(controller.signal)
      .then((loaded) => {
        setCompanies(loaded);
        setLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError("応募企業情報を取得できませんでした。時間をおいて再読み込みしてください。");
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [mode]);

  if (mode === null) {
    return (
      <PageContainer width={960} className="text-body-sm text-ink-sub">
        ホームへ戻っています。
      </PageContainer>
    );
  }

  const isPracticeMode = mode === "practice";
  const setupPath = `/practice/setup?mode=${mode}`;
  const encodedSetupPath = encodeURIComponent(setupPath);
  const maxTurns = parseMaxTurns(maxTurnsInput);
  const maxTurnsError =
    maxTurns === null
      ? `最大ターン数は${MIN_MAX_TURNS}〜${MAX_MAX_TURNS}の整数で入力してください。`
      : null;
  // 本番モードは対象企業が1つ選ばれていることが条件。練習モードは条件なし（S-05 5章）
  const canStart =
    isPracticeMode || (companyId !== null && maxTurns !== null);

  function adjustMaxTurns(amount: -1 | 1) {
    const entered = Number(maxTurnsInput);
    const base = Number.isSafeInteger(entered)
      ? entered
      : DEFAULT_MAX_TURNS;
    const adjusted = Math.min(
      MAX_MAX_TURNS,
      Math.max(MIN_MAX_TURNS, base + amount),
    );
    setMaxTurnsInput(String(adjusted));
  }

  return (
    <PageContainer width={960} className="flex flex-col gap-[22px]">
      <div className="flex flex-col gap-1.5">
        <span className="text-label text-ink-muted">
          ホーム / {isPracticeMode ? "練習モード" : "本番モード"}
        </span>
        <h1 className="text-heading font-bold">
          {isPracticeMode ? "練習モードの設定" : "本番モードの設定"}
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-[22px]">
        <Card className="flex flex-col gap-3.5 px-[26px] py-6">
          <h2 className="text-card-sm font-bold">回答方式</h2>
          <div className="flex overflow-hidden rounded-control border border-line-strong">
            {ANSWER_METHODS.map((method) => (
              <button
                key={method}
                type="button"
                aria-pressed={answerMethod === method}
                onClick={() => setAnswerMethod(method)}
                className={cn(
                  "h-btn-sm flex-1 text-body-sm",
                  answerMethod === method
                    ? "bg-accent font-medium text-white"
                    : "text-ink-label hover:bg-canvas",
                )}
              >
                {ANSWER_METHOD_LABEL[method]}
              </button>
            ))}
          </div>
          {/* マイクの使用許可はこの画面では求めない（共通仕様 8章） */}
          <p className="text-note leading-[1.7] text-ink-muted">
            音声を選ぶとマイクの使用許可を求めます。
          </p>
        </Card>

        <Card className="flex flex-col gap-3.5 px-[26px] py-6">
          <h2 className="text-card-sm font-bold">質問の強度</h2>
          <div className="flex gap-2.5">
            {STRENGTHS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={strength === value}
                onClick={() => setStrength(value)}
                className={cn(
                  "h-btn-sm flex-1 rounded-control text-body-sm",
                  strength === value
                    ? "border-2 border-accent bg-accent-soft font-medium text-accent"
                    : "border border-line-strong text-ink-label hover:bg-canvas",
                )}
              >
                {QUESTION_STRENGTH_LABEL[value]}
              </button>
            ))}
          </div>
          <p className="text-note leading-[1.7] text-ink-muted">
            深掘りの度合いが変わります。強度は毎ターン面接官に伝わります。
          </p>
        </Card>

        {!isPracticeMode && (
          <Card className="flex flex-col gap-3.5 px-[26px] py-6">
            <h2 className="text-card-sm font-bold">最大ターン数</h2>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                aria-label="最大ターン数を1減らす"
                onClick={() => adjustMaxTurns(-1)}
                className="grid size-10 place-items-center rounded-control border border-line-strong text-body hover:bg-canvas"
              >
                −
              </button>
              <input
                id="max-turns"
                type="number"
                min={MIN_MAX_TURNS}
                max={MAX_MAX_TURNS}
                step={1}
                inputMode="numeric"
                aria-label="最大ターン数"
                aria-invalid={maxTurnsError ? true : undefined}
                aria-describedby={maxTurnsError ? "max-turns-error" : "max-turns-hint"}
                value={maxTurnsInput}
                onChange={(event) => setMaxTurnsInput(event.target.value)}
                className={cn(
                  "h-10 w-24 rounded-control border bg-surface px-3 text-center text-body outline-none focus:border-accent",
                  maxTurnsError ? "border-danger" : "border-line-strong",
                )}
              />
              <button
                type="button"
                aria-label="最大ターン数を1増やす"
                onClick={() => adjustMaxTurns(1)}
                className="grid size-10 place-items-center rounded-control border border-line-strong text-body hover:bg-canvas"
              >
                ＋
              </button>
              <span className="text-body-sm text-ink-sub">ターン</span>
            </div>
            {maxTurnsError ? (
              <p id="max-turns-error" role="alert" className="text-note text-danger">
                {maxTurnsError}
              </p>
            ) : (
              <p id="max-turns-hint" className="text-note text-ink-muted">
                {MIN_MAX_TURNS}〜{MAX_MAX_TURNS}ターンの範囲で設定できます。
              </p>
            )}
          </Card>
        )}

        {!isPracticeMode && (
          <Card className="flex flex-col gap-3.5 px-[26px] py-6">
            <h2 className="text-card-sm font-bold">読み上げモード</h2>
            <div className="flex overflow-hidden rounded-control border border-line-strong">
              {READ_ALOUD_MODES.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`読み上げモード: ${READ_ALOUD_MODE_LABEL[value]}`}
                  aria-pressed={readAloudMode === value}
                  onClick={() => setReadAloudMode(value)}
                  className={cn(
                    "h-btn-sm flex-1 text-body-sm",
                    readAloudMode === value
                      ? "bg-accent font-medium text-white"
                      : "text-ink-label hover:bg-canvas",
                  )}
                >
                  {READ_ALOUD_MODE_LABEL[value]}
                </button>
              ))}
            </div>
            <p className="text-note leading-[1.7] text-ink-muted">
              面接中にも読み上げモードを変更できます。
            </p>
          </Card>
        )}
      </div>

      <Card className="flex flex-col">
        <div className="flex items-center justify-between border-b border-divider px-[26px] py-5">
          <h2 className="text-card-sm font-bold">対象企業</h2>
          <Link
            href={`/companies/new?from=${encodedSetupPath}`}
            className="rounded-control border border-line-strong px-3 py-[7px] text-label hover:bg-canvas"
          >
            企業を追加
          </Link>
        </div>
        {loading ? (
          <div className="px-[26px] py-8 text-body-sm text-ink-sub">
            応募企業情報を読み込んでいます。
          </div>
        ) : error ? (
          <div role="alert" className="px-[26px] py-8 text-body-sm text-danger">
            {error}
          </div>
        ) : companies.length === 0 ? (
          <div className="flex flex-col items-start gap-4 px-[26px] py-8">
            <p className="text-body-sm text-ink-sub">
              登録された企業がありません。企業を追加すると、その内容をもとに質問が作られます。
            </p>
            <Link href={`/companies/new?from=${encodedSetupPath}`} className={buttonClassName("primary", "sm")}>
              企業を追加
            </Link>
          </div>
        ) : (
          // 練習モードは応募企業情報を使わないため、選べない状態にする（S-05 5章）
          <div
            className={cn(
              "flex flex-col",
              isPracticeMode && "pointer-events-none opacity-50",
            )}
          >
            {companies.map((company) => {
              const selected = companyId === company.id;
              const sections = filledSections(company);
              return (
                <div
                  key={company.id}
                  className={cn(
                    "flex items-center gap-3.5 border-b border-divider px-[26px] py-4 last:border-b-0",
                    selected && "bg-accent-soft",
                  )}
                >
                  <button
                    type="button"
                    aria-pressed={selected}
                    disabled={isPracticeMode}
                    onClick={() => setCompanyId(company.id)}
                    className="flex flex-1 items-center gap-3.5 text-left"
                  >
                    <RadioMark selected={selected} />
                    <span className="flex flex-1 flex-col gap-[3px]">
                      <span
                        className={cn(
                          "text-body",
                          selected ? "font-medium" : "text-ink-label",
                        )}
                      >
                        {company.company_name}
                      </span>
                      <span className="text-note text-ink-sub">
                        {sections.length > 0
                          ? sections.join(" / ")
                          : "未入力"}
                      </span>
                    </span>
                  </button>
                  <Link
                    href={`/companies/edit?id=${company.id}&from=${encodedSetupPath}`}
                    className="text-note text-accent hover:underline"
                  >
                    編集
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between pt-1">
        {/* 登録件数にかかわらず常に出す（S-05 4章） */}
        <Link href="/tutorial" className="text-label text-accent hover:underline">
          先にチュートリアルを試す
        </Link>
        <div className="flex items-center gap-3">
          {/* 練習モード固定の画面では出さない（S-05 5章） */}
          {!isPracticeMode && (
            <span className="text-label text-ink-muted">
              {maxTurns === null
                ? "最大ターン数を確認してください"
                : `上限 ${maxTurns} ターンで自動終了します`}
            </span>
          )}
          <Button
            disabled={!canStart}
            onClick={() => {
              if (isPracticeMode) {
                router.push("/practice");
                return;
              }
              if (companyId === null || maxTurns === null) return;
              const params = new URLSearchParams({
                companyId: String(companyId),
                strength,
                answerMethod,
                readAloud: readAloudMode,
                maxTurns: String(maxTurns),
              });
              router.push(`/interview?${params.toString()}`);
            }}
            className="px-[34px]"
          >
            {isPracticeMode
              ? "練習モードを始める"
              : "本番モードを始める"}
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
