"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PageContainer } from "@/components/layout/PageContainer";
import { Button, buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { filledSections } from "@/lib/application";
import { cn } from "@/lib/cn";
import { MAX_TURNS } from "@/lib/interview";
import { MOCK_APPLICATIONS } from "@/mocks/applications";
import type { AnswerMethod, QuestionStrength } from "@/mocks/types";
import { ANSWER_METHOD_LABEL, QUESTION_STRENGTH_LABEL } from "@/mocks/types";

type Mode = "interview" | "practice";

const STRENGTHS: QuestionStrength[] = ["easy", "standard", "hard"];
const ANSWER_METHODS: AnswerMethod[] = ["voice", "text"];

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
 * S-05 練習の設定。
 * 選んだ内容はサーバーに保存せず、S-08 / S-09 へ引き渡す（ADR-0008）。
 * 引き渡す状態管理は API 連携のときに入れるため、ここでは遷移だけを行う。
 */
export default function PracticeSetupPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("interview");
  const [answerMethod, setAnswerMethod] = useState<AnswerMethod>("voice");
  const [strength, setStrength] = useState<QuestionStrength>("standard");
  const [companyId, setCompanyId] = useState<number | null>(null);

  const isPracticeMode = mode === "practice";
  // 本番モードは対象企業が1つ選ばれていることが条件。練習モードは条件なし（S-05 5章）
  const canStart = isPracticeMode || companyId !== null;

  return (
    <PageContainer width={960} className="flex flex-col gap-[22px]">
      <div className="flex flex-col gap-1.5">
        <span className="text-label text-ink-muted">ホーム / 練習</span>
        <h1 className="text-heading font-bold">練習の設定</h1>
      </div>

      <Card className="flex flex-col gap-3.5 px-[26px] py-6">
        <h2 className="text-card-sm font-bold">モード</h2>
        <div className="grid grid-cols-2 gap-3.5">
          <button
            type="button"
            aria-pressed={!isPracticeMode}
            onClick={() => setMode("interview")}
            className={cn(
              "flex gap-3 rounded-[5px] px-[18px] py-4 text-left",
              isPracticeMode
                ? "border border-line-strong bg-surface"
                : "border-2 border-accent bg-accent-soft",
            )}
          >
            <span className="mt-0.5">
              <RadioMark selected={!isPracticeMode} />
            </span>
            <span className="flex flex-col gap-1">
              <span className="text-body font-medium">本番モード</span>
              <span className="text-note leading-[1.7] text-ink-sub">
                AI 面接官と連続した会話で模擬面接を行う
              </span>
            </span>
          </button>
          <button
            type="button"
            aria-pressed={isPracticeMode}
            onClick={() => setMode("practice")}
            className={cn(
              "flex gap-3 rounded-[5px] px-[18px] py-4 text-left",
              isPracticeMode
                ? "border-2 border-accent bg-accent-soft"
                : "border border-line-strong bg-surface",
            )}
          >
            <span className="mt-0.5">
              <RadioMark selected={isPracticeMode} />
            </span>
            <span className="flex flex-col gap-1">
              <span
                className={cn(
                  "flex items-center gap-2 text-body font-medium",
                  !isPracticeMode && "text-ink-label",
                )}
              >
                練習モード
                {/* 練習モードは画面のモックだけを作る（画面一覧 3章） */}
                <Chip className="border-none bg-[#eef1f3] text-[10px] text-ink-sub">
                  モック
                </Chip>
              </span>
              <span className="text-note leading-[1.7] text-ink-sub">
                弱点ごとの個別トレーニングを選ぶ
              </span>
            </span>
          </button>
        </div>
      </Card>

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
      </div>

      <Card className="flex flex-col">
        <div className="flex items-center justify-between border-b border-divider px-[26px] py-5">
          <h2 className="text-card-sm font-bold">対象企業</h2>
          <Link
            href="/companies/new?from=/practice/setup"
            className="rounded-control border border-line-strong px-3 py-[7px] text-label hover:bg-canvas"
          >
            企業を追加
          </Link>
        </div>
        {MOCK_APPLICATIONS.length === 0 ? (
          <div className="flex flex-col items-start gap-4 px-[26px] py-8">
            <p className="text-body-sm text-ink-sub">
              登録された企業がありません。企業を追加すると、その内容をもとに質問が作られます。
            </p>
            <Link href="/companies/new?from=/practice/setup" className={buttonClassName("primary", "sm")}>
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
            {MOCK_APPLICATIONS.map((application) => {
              const selected = companyId === application.id;
              const sections = filledSections(application);
              return (
                <div
                  key={application.id}
                  className={cn(
                    "flex items-center gap-3.5 border-b border-divider px-[26px] py-4 last:border-b-0",
                    selected && "bg-accent-soft",
                  )}
                >
                  <button
                    type="button"
                    aria-pressed={selected}
                    disabled={isPracticeMode}
                    onClick={() => setCompanyId(application.id)}
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
                        {application.company_name}
                      </span>
                      {/* 何も入っていなければ職種だけを出す（S-05 3.2） */}
                      <span className="text-note text-ink-sub">
                        {[
                          application.job_title,
                          sections.length > 0
                            ? `${sections.join("・")}あり`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" / ")}
                      </span>
                    </span>
                  </button>
                  <Link
                    href={`/companies/${application.id}/edit?from=/practice/setup`}
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
          {/* 練習モードを選んでいるあいだは出さない（S-05 5章） */}
          {!isPracticeMode && (
            <span className="text-label text-ink-muted">
              上限 {MAX_TURNS} ターンで自動終了します
            </span>
          )}
          <Button
            disabled={!canStart}
            onClick={() => router.push(isPracticeMode ? "/practice" : "/interview")}
            className="px-[34px]"
          >
            開始する
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
