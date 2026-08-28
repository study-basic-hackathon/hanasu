import type {
  ChatTurn,
  EvaluationQuantitativeScores,
} from "@/lib/domain";
import { scoreFillerRate, scoreSpeakingSpeed } from "@/lib/score";

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function hasDuration(turn: ChatTurn): boolean {
  return (
    turn.audio_duration_ms !== undefined &&
    Number.isFinite(turn.audio_duration_ms) &&
    turn.audio_duration_ms > 0
  );
}

/** 会話ターンの計測値を、POST /evaluations に渡す定量スコアへ集約する。 */
export function buildEvaluationScores(
  turns: ChatTurn[],
): Partial<EvaluationQuantitativeScores> {
  const answers = turns.filter((turn) => turn.role === "user");
  if (answers.length === 0) {
    throw new Error("評価には1件以上の回答が必要です。");
  }

  const speakingSpeedAnswers = answers.filter(
    (turn) =>
      hasDuration(turn) &&
      turn.character_count !== undefined &&
      Number.isFinite(turn.character_count) &&
      turn.character_count >= 0,
  );
  const fillerAnswers = answers.filter(
    (turn) =>
      hasDuration(turn) &&
      turn.filler_count !== undefined &&
      Number.isFinite(turn.filler_count) &&
      turn.filler_count >= 0,
  );

  const scores: Partial<EvaluationQuantitativeScores> = {};

  if (speakingSpeedAnswers.length > 0) {
    const durationMs = speakingSpeedAnswers.reduce(
      (sum, turn) => sum + (turn.audio_duration_ms ?? 0),
      0,
    );
    const chars = speakingSpeedAnswers.reduce(
      (sum, turn) => sum + (turn.character_count ?? 0),
      0,
    );
    const charsPerMinute = (chars * 60_000) / durationMs;

    scores.speaking_speed = {
      score: scoreSpeakingSpeed(charsPerMinute),
      value: Math.round(charsPerMinute),
      unit: "文字/分",
    };
  }

  if (fillerAnswers.length > 0) {
    const durationMs = fillerAnswers.reduce(
      (sum, turn) => sum + (turn.audio_duration_ms ?? 0),
      0,
    );
    const fillers = fillerAnswers.reduce(
      (sum, turn) => sum + (turn.filler_count ?? 0),
      0,
    );
    const fillersPerMinute = (fillers * 60_000) / durationMs;

    scores.filler = {
      score: scoreFillerRate(fillersPerMinute),
      value: fillers,
      unit: "回",
      value_per_minute: roundToOneDecimal(fillersPerMinute),
    };
  }

  return scores;
}
