import type {
  ChatTurn,
  EvaluationQuantitativeScores,
} from "@/lib/domain";
import {
  scoreFillerRate,
  scoreFillersPerAnswer,
  scoreSpeakingSpeed,
} from "@/lib/score";

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

/** 会話ターンの計測値を、POST /evaluations に渡す暫定定量スコアへ集約する。 */
export function buildEvaluationScores(
  turns: ChatTurn[],
): EvaluationQuantitativeScores {
  const answers = turns.filter((turn) => turn.role === "user");
  if (answers.length === 0) {
    throw new Error("評価には1件以上の回答が必要です。");
  }

  const voiceAnswers = answers.filter(
    (turn) =>
      turn.audio_duration_ms !== undefined &&
      turn.audio_duration_ms > 0 &&
      turn.character_count !== undefined &&
      turn.character_count >= 0,
  );
  const totalFillers = answers.reduce(
    (sum, turn) => sum + (turn.filler_count ?? 0),
    0,
  );

  const scores: EvaluationQuantitativeScores = {
    filler: {
      score: 0,
      value: totalFillers,
      unit: "回",
    },
  };

  if (voiceAnswers.length === answers.length) {
    const durationMs = voiceAnswers.reduce(
      (sum, turn) => sum + (turn.audio_duration_ms ?? 0),
      0,
    );
    const chars = voiceAnswers.reduce(
      (sum, turn) => sum + (turn.character_count ?? 0),
      0,
    );
    const charsPerMinute = Math.round((chars * 60_000) / durationMs);
    const fillersPerMinute = roundToOneDecimal(
      (totalFillers * 60_000) / durationMs,
    );

    scores.speaking_speed = {
      score: scoreSpeakingSpeed(charsPerMinute),
      value: charsPerMinute,
      unit: "文字/分",
    };
    scores.filler.score = scoreFillerRate(fillersPerMinute);
    scores.filler.value_per_minute = fillersPerMinute;
  } else {
    scores.filler.score = scoreFillersPerAnswer(
      totalFillers / answers.length,
    );

    if (voiceAnswers.length > 0) {
      const durationMs = voiceAnswers.reduce(
        (sum, turn) => sum + (turn.audio_duration_ms ?? 0),
        0,
      );
      const chars = voiceAnswers.reduce(
        (sum, turn) => sum + (turn.character_count ?? 0),
        0,
      );
      const charsPerMinute = Math.round((chars * 60_000) / durationMs);
      scores.speaking_speed = {
        score: scoreSpeakingSpeed(charsPerMinute),
        value: charsPerMinute,
        unit: "文字/分",
      };
    }
  }

  return scores;
}
