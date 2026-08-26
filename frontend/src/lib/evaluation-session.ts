import type { CreateEvaluationInput } from "@/lib/evaluation-api";

const STORAGE_KEY_PREFIX = "hanasu.evaluationSession.";

export type EvaluationSession = CreateEvaluationInput & {
  companyName: string | null;
};

function key(evaluationId: number): string {
  return `${STORAGE_KEY_PREFIX}${evaluationId}`;
}

/** 評価失敗時の再実行と、API 未提供の実施条件表示に必要な会話状態をタブ内だけに保持する。 */
export function storeEvaluationSession(
  evaluationId: number,
  session: EvaluationSession,
): void {
  window.sessionStorage.setItem(key(evaluationId), JSON.stringify(session));
}

export function loadEvaluationSession(
  evaluationId: number,
): EvaluationSession | null {
  const stored = window.sessionStorage.getItem(key(evaluationId));
  if (!stored) return null;

  try {
    const parsed: unknown = JSON.parse(stored);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("turns" in parsed) ||
      !Array.isArray(parsed.turns) ||
      !("scores" in parsed) ||
      !parsed.scores ||
      typeof parsed.scores !== "object"
    ) {
      return null;
    }
    return parsed as EvaluationSession;
  } catch {
    return null;
  }
}
