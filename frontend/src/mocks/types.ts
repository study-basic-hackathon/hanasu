/**
 * モックのダミーデータの型。
 * 2周目の API 連携でそのまま差し替えられるよう、API仕様.md の入出力に寄せた形で持つ。
 * 応募情報の項目定義は #17、質問強度の表記は会話 API の実装時に確定する。
 */

/** 質問の強度（楽々 / 標準 / 厳しめ） */
export type QuestionStrength = "easy" | "standard" | "hard";

export const QUESTION_STRENGTH_LABEL: Record<QuestionStrength, string> = {
  easy: "楽々",
  standard: "標準",
  hard: "厳しめ",
};

/** 回答方式（音声 / 文字入力） */
export type AnswerMethod = "voice" | "text";

export const ANSWER_METHOD_LABEL: Record<AnswerMethod, string> = {
  voice: "音声",
  text: "文字入力",
};

/**
 * 応募情報（API仕様 4章）。
 * 企業ごとの情報と応募者自身の情報を1レコードで持つ。企業名だけが必須。
 */
export type Application = {
  id: number;
  /** 企業名（必須） */
  company_name: string;
  /** 募集要項 URL */
  posting_url: string;
  /** 職種 */
  job_title: string;
  /** 応募書類（貼り付け） */
  documents: string;
  /** 志望動機 */
  motivation: string;
  /** 現職 / 直近の所属 */
  current_position: string;
  /** 経験年数（0〜99 の整数） */
  experience_years: number | null;
  /** 経歴・実績 */
  resume: string;
  /** 備考 */
  note: string;
};

/** 評価の処理状態（API仕様 5.6） */
export type EvaluationStatus = "processing" | "completed" | "failed";

/** 定量の項目別スコア（話の速さ・フィラーの数） */
export type QuantitativeScore = {
  score: number;
  value: number;
  unit: string;
  /** フィラーだけが持つ毎分の値（共通仕様 10章） */
  value_per_minute?: number;
};

/** 定性の項目別スコア（構成・内容）。LLM の出力 */
export type QualitativeScore = {
  score: number;
  comment: string;
};

export type EvaluationScores = {
  speaking_speed: QuantitativeScore;
  filler: QuantitativeScore;
  structure_content: QualitativeScore;
};

/**
 * 評価結果（API仕様 5.6）。
 * 企業名・質問の強度・ターン数は画面のために評価結果へ加えることが決まっている
 * （画面と API の対応 6章）。回答方式は S-04 の実施条件に出す。
 */
export type Evaluation = {
  evaluation_id: number;
  /** チュートリアルの結果は企業を持たない */
  company_id: number | null;
  /** 企業を削除しても名前を出せるよう、登録時の値の写しを持つ */
  company_name: string | null;
  question_strength: QuestionStrength | null;
  answer_method: AnswerMethod;
  turn_count: number;
  status: EvaluationStatus;
  created_at: string;
  /** processing / failed のあいだは持たない */
  total_score: number | null;
  scores: EvaluationScores | null;
  advice: string[];
};
