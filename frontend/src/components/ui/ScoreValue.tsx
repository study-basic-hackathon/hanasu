import { cn } from "@/lib/cn";
import { SCORE_TEXT_CLASS, scoreLevel } from "@/lib/score";

type ScoreValueProps = {
  /** 計測対象外の項目は null。共通仕様 9章に従い `—` を出す */
  score: number | null;
  /** sm は行内（S-04）、lg はカード（S-14） */
  size?: "sm" | "lg";
  className?: string;
};

/**
 * 項目別スコアの点数（共通仕様 10章）。
 * 実測値と読み違えられないよう、数値に単位 `点` を添える。
 */
export function ScoreValue({ score, size = "sm", className }: ScoreValueProps) {
  const isSmall = size === "sm";

  if (score === null) {
    return (
      <span
        className={cn(
          "font-bold text-ink-muted",
          isSmall ? "" : "text-score-item leading-none",
          className,
        )}
      >
        —
      </span>
    );
  }

  return (
    <span
      className={cn(
        "font-bold",
        isSmall ? "" : "text-score-item leading-none",
        SCORE_TEXT_CLASS[scoreLevel(score)],
        className,
      )}
    >
      {score}
      <span className={cn("font-normal", isSmall ? "" : "text-label")}> 点</span>
    </span>
  );
}
