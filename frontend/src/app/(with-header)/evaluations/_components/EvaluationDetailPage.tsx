"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { EvaluationView } from "./EvaluationView";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card } from "@/components/ui/Card";
import type { Evaluation } from "@/lib/domain";
import { createEvaluation, getEvaluation } from "@/lib/evaluation-api";
import {
  loadEvaluationSession,
  storeEvaluationSession,
  type EvaluationSession,
} from "@/lib/evaluation-session";

const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 5 * 60_000;

export function EvaluationDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = Number(searchParams.get("id"));
  const fromInterview = searchParams.get("from") === "interview";
  const session = useMemo(
    () =>
      typeof window !== "undefined" && Number.isSafeInteger(id) && id > 0
        ? loadEvaluationSession(id)
        : null,
    [id],
  );
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!Number.isSafeInteger(id) || id <= 0) return;

    const storedSession: EvaluationSession | null = session;
    const controller = new AbortController();
    const startedAt = Date.now();
    let timer: number | undefined;

    const load = async () => {
      try {
        const loaded = await getEvaluation(id, controller.signal);
        setEvaluation(
          storedSession
            ? {
                ...loaded,
                company_id: loaded.company_id ?? storedSession.companyId,
                company_name:
                  loaded.company_name ?? storedSession.companyName,
                question_strength: storedSession.questionStrength,
                answer_method: storedSession.answerMethod,
                turn_count: storedSession.turns.filter(
                  (turn) => turn.role === "user",
                ).length,
              }
            : loaded,
        );
        if (
          loaded.status === "processing" &&
          fromInterview &&
          Date.now() - startedAt < POLL_TIMEOUT_MS
        ) {
          timer = window.setTimeout(load, POLL_INTERVAL_MS);
        } else if (loaded.status === "processing" && fromInterview) {
          setError("評価の完了を確認できませんでした。履歴からもう一度開いてください。");
        }
      } catch {
        if (!controller.signal.aborted) {
          setError("評価結果を取得できませんでした。時間をおいて再読み込みしてください。");
        }
      }
    };

    void load();
    return () => {
      controller.abort();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [fromInterview, id, session]);

  async function retryEvaluation() {
    if (!session || retrying) return;
    setRetrying(true);
    setError(null);
    setEvaluation((current) =>
      current ? { ...current, status: "processing" } : current,
    );

    try {
      const nextId = await createEvaluation(session);
      storeEvaluationSession(nextId, session);
      router.replace(`/evaluations/detail?id=${nextId}&from=interview`);
    } catch {
      setError("評価を再実行できませんでした。時間をおいてもう一度お試しください。");
      setRetrying(false);
    }
  }

  if (!Number.isSafeInteger(id) || id <= 0) {
    return <ErrorCard message="評価 ID が指定されていません。" />;
  }
  if (error) return <ErrorCard message={error} />;
  if (!evaluation) {
    return (
      <PageContainer width={1080} className="text-body-sm text-ink-sub">
        評価結果を読み込んでいます。
      </PageContainer>
    );
  }

  return (
    <EvaluationView
      evaluation={evaluation}
      fromInterview={fromInterview}
      onRetry={session ? retryEvaluation : undefined}
    />
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <PageContainer width={1080} className="grid place-items-center">
      <Card className="flex w-[440px] flex-col items-center gap-4 px-10 py-8">
        <h1 className="text-card font-bold">評価結果を開けません</h1>
        <p role="alert" className="text-center text-label leading-[1.9] text-danger">
          {message}
        </p>
        <Link href="/evaluations" className="text-label text-accent hover:underline">
          履歴に戻る
        </Link>
      </Card>
    </PageContainer>
  );
}
