"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import {
  answerMethodPath,
  basePathOf,
} from "@/components/interview/InterviewRoute";
import type { InterviewMode } from "@/components/interview/InterviewScreen";
import type { AnswerMethod } from "@/lib/domain";

function answerMethodOf(value: string | null): AnswerMethod {
  return value === "text" ? "text" : "voice";
}

/**
 * 回答方式を分ける前の URL（`/interview`・`/tutorial`）を、方式ごとのページへ送る。
 * 旧 URL に付いていた `answerMethod` は落とし、それ以外の設定はそのまま引き継ぐ。
 */
export function AnswerMethodRedirect({ mode }: { mode: InterviewMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const answerMethod = answerMethodOf(searchParams.get("answerMethod"));
    const params = new URLSearchParams(searchParams);
    params.delete("answerMethod");
    router.replace(answerMethodPath(mode, answerMethod, params.toString()));
  }, [mode, router, searchParams]);

  return (
    <p className="p-8 text-body-sm text-ink-sub">
      {basePathOf(mode) === "/tutorial"
        ? "チュートリアルを準備しています。"
        : "面接を準備しています。"}
    </p>
  );
}
