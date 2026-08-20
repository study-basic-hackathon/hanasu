import { cn } from "@/lib/cn";
import { SCORE_BAR_CLASS, scoreLevel, scorePercent } from "@/lib/score";

type ScoreBarProps = {
  score: number;
  /** sm は 6px（S-04 / S-16）、md は 8px（S-14） */
  size?: "sm" | "md";
  className?: string;
};

/** スコアバー（共通仕様 9章）。長さはスコアをそのまま百分率にする */
export function ScoreBar({ score, size = "sm", className }: ScoreBarProps) {
  const level = scoreLevel(score);
  const isSmall = size === "sm";

  return (
    <div
      className={cn(
        "w-full bg-track",
        isSmall ? "h-1.5 rounded-chip" : "h-2 rounded-control",
        className,
      )}
    >
      <div
        className={cn(
          "h-full",
          isSmall ? "rounded-chip" : "rounded-control",
          SCORE_BAR_CLASS[level],
        )}
        style={{ width: `${scorePercent(score)}%` }}
      />
    </div>
  );
}
