/** フロントエンドで共有する業務データの型。API と画面の境界で利用する。 */

export type QuestionStrength = "easy" | "standard" | "hard" | "custom";

export const CUSTOM_QUESTION_STRENGTH_MAX_LENGTH = 500;

export const QUESTION_STRENGTH_LABEL: Record<QuestionStrength, string> = {
  easy: "楽々",
  standard: "標準",
  hard: "厳しめ",
  custom: "カスタム",
};

export type AnswerMethod = "voice" | "text";

export const ANSWER_METHOD_LABEL: Record<AnswerMethod, string> = {
  voice: "音声入力",
  text: "文字入力",
};

export type ReadAloudMode = "enabled" | "disabled";

export const READ_ALOUD_MODE_LABEL: Record<ReadAloudMode, string> = {
  enabled: "読み上げる",
  disabled: "読み上げない",
};

export type TranscriptDisplayMode = "clean" | "raw";

export const TRANSCRIPT_DISPLAY_MODE_LABEL: Record<
  TranscriptDisplayMode,
  string
> = {
  clean: "フィラーなし",
  raw: "フィラーあり",
};

/** S-05〜S-07 が扱う応募企業情報。応募情報 API の6項目と揃える。 */
export type Application = {
  id: number;
  company_name: string;
  company_url: string;
  motivation: string;
  resume: string;
  note: string;
  job_summary: string;
};

export type EvaluationStatus = "processing" | "completed" | "failed";

export type QuantitativeScore = {
  score: number;
  value: number;
  unit: string;
  value_per_minute?: number;
};

export type QualitativeScore = {
  score: number;
  comment: string;
};

export type EvaluationScores = {
  /** 文字入力だけの面接では計測できないため持たない。 */
  speaking_speed?: QuantitativeScore;
  /** 音声の計測値がない回答では持たない。 */
  filler?: QuantitativeScore;
  structure_content: QualitativeScore;
};

export type EvaluationQuantitativeScores = Partial<
  Pick<EvaluationScores, "speaking_speed" | "filler">
>;

/**
 * API がまだ返さない実施条件は null にし、取得不能な値は画面で「—」表示する。
 */
export type Evaluation = {
  evaluation_id: number;
  company_id: number | null;
  company_name: string | null;
  question_strength: QuestionStrength | null;
  answer_method: AnswerMethod | null;
  turn_count: number | null;
  status: EvaluationStatus;
  created_at: string;
  total_score: number | null;
  scores: EvaluationScores | null;
  advice: string[];
  error?: string;
};

export type ChatTurn = {
  role: "assistant" | "user";
  /** 通常の画面表示に使うテキスト。音声回答では STT のフィラー除去済みテキスト。 */
  content: string;
  /** STT のフィラートークン付きテキスト。chat / evaluation へ送る。 */
  raw_content?: string;
  time?: string;
  audio_seconds?: number;
  audio_duration_ms?: number;
  character_count?: number;
  filler_count?: number;
  filler_count_per_min?: number;
  chars_per_min?: number;
};

export type SignedInUser = {
  id: number;
  username: string;
};
