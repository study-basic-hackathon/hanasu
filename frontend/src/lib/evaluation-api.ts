import { apiRequest, jsonRequest } from "@/lib/api-client";
import type {
  AnswerMethod,
  ChatTurn,
  Evaluation,
  EvaluationQuantitativeScores,
  EvaluationScores,
  QuestionStrength,
} from "@/lib/domain";

type EvaluationListItemResponse = {
  evaluation_id: number;
  created_at: string;
  status: Evaluation["status"];
  total_score: number | null;
  company_name: string | null;
  scores: EvaluationScores | null;
};

type EvaluationListResponse = {
  evaluations: EvaluationListItemResponse[];
};

type EvaluationDetailResponse = Partial<
  Pick<
    Evaluation,
    | "company_id"
    | "company_name"
    | "created_at"
    | "total_score"
    | "scores"
    | "advice"
    | "error"
  >
> & {
  evaluation_id: number;
  status: Evaluation["status"];
};

function normalizeEvaluation(
  response: EvaluationListItemResponse | EvaluationDetailResponse,
): Evaluation {
  return {
    evaluation_id: response.evaluation_id,
    company_id: "company_id" in response ? (response.company_id ?? null) : null,
    company_name: response.company_name ?? null,
    question_strength: null,
    answer_method: null,
    turn_count: null,
    status: response.status,
    created_at: response.created_at ?? "",
    total_score: response.total_score ?? null,
    scores: response.scores ?? null,
    advice: "advice" in response ? (response.advice ?? []) : [],
    error: "error" in response ? response.error : undefined,
  };
}

export async function listEvaluations(
  signal?: AbortSignal,
): Promise<Evaluation[]> {
  const response = await apiRequest<EvaluationListResponse>("/evaluations", {
    signal,
  });
  return response.evaluations.map(normalizeEvaluation);
}

export async function getEvaluation(
  evaluationId: number,
  signal?: AbortSignal,
): Promise<Evaluation> {
  const response = await apiRequest<EvaluationDetailResponse>(
    `/evaluations/${evaluationId}`,
    { signal },
  );
  return normalizeEvaluation(response);
}

export type CreateEvaluationInput = {
  companyId: number | null;
  turns: ChatTurn[];
  scores: Partial<EvaluationQuantitativeScores>;
  questionStrength: QuestionStrength | null;
  answerMethod: AnswerMethod;
};

export async function createEvaluation(
  input: CreateEvaluationInput,
): Promise<number> {
  const response = await jsonRequest<{ evaluation_id: number }>(
    "/evaluations",
    "POST",
    {
      company_id: input.companyId,
      question_strength: input.questionStrength,
      answer_method: input.answerMethod,
      turn_count: input.turns.filter((turn) => turn.role === "user").length,
      turns: input.turns.map((turn) => ({
        role: turn.role,
        content: turn.raw_content ?? turn.content,
      })),
      scores: input.scores,
    },
  );
  return response.evaluation_id;
}
