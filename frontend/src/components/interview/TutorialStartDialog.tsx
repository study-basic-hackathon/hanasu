"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/cn";
import type { AnswerMethod, ReadAloudMode } from "@/lib/domain";
import { ANSWER_METHOD_LABEL, READ_ALOUD_MODE_LABEL } from "@/lib/domain";

const ANSWER_METHODS: AnswerMethod[] = ["voice", "text"];
const READ_ALOUD_MODES: ReadAloudMode[] = ["enabled", "disabled"];

type TutorialStartDialogProps = {
  open: boolean;
  /** 開いたときに選ばれている回答方式 */
  defaultAnswerMethod: AnswerMethod;
  /** 開いたときに選ばれている読み上げモード */
  defaultReadAloudMode: ReadAloudMode;
  onCancel: () => void;
};

function ToggleGroup<T extends string>({
  label,
  values,
  selected,
  labelOf,
  onSelect,
}: {
  label: string;
  values: T[];
  selected: T;
  labelOf: Record<T, string>;
  onSelect: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-label font-medium text-ink-label">{label}</span>
      <div className="flex overflow-hidden rounded-control border border-line-strong">
        {values.map((value) => (
          <button
            key={value}
            type="button"
            aria-label={`${label}: ${labelOf[value]}`}
            aria-pressed={selected === value}
            onClick={() => onSelect(value)}
            className={cn(
              "h-btn-sm flex-1 text-body-sm",
              selected === value
                ? "bg-accent font-medium text-white"
                : "bg-surface text-ink-label hover:bg-canvas",
            )}
          >
            {labelOf[value]}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * チュートリアル（S-03）を始める前に、回答方式と読み上げモードを1回だけ確認する。
 * 選んだ内容は保存せず、`/tutorial/<回答方式>` へクエリで引き渡す。
 */
export function TutorialStartDialog({
  open,
  defaultAnswerMethod,
  defaultReadAloudMode,
  onCancel,
}: TutorialStartDialogProps) {
  const router = useRouter();
  // 選ぶまでは開いた画面での選択をそのまま映す。閉じるときに捨てて初期値へ戻す
  const [chosen, setChosen] = useState<{
    answerMethod: AnswerMethod;
    readAloudMode: ReadAloudMode;
  } | null>(null);
  const answerMethod = chosen?.answerMethod ?? defaultAnswerMethod;
  const readAloudMode = chosen?.readAloudMode ?? defaultReadAloudMode;

  return (
    <ConfirmDialog
      open={open}
      message={
        <div className="flex flex-col gap-4">
          <h2 className="text-card-sm font-bold">
            どの方式でチュートリアルを試しますか？
          </h2>
          <ToggleGroup
            label="回答方式"
            values={ANSWER_METHODS}
            selected={answerMethod}
            labelOf={ANSWER_METHOD_LABEL}
            onSelect={(value) =>
              setChosen({ answerMethod: value, readAloudMode })
            }
          />
          <ToggleGroup
            label="読み上げモード"
            values={READ_ALOUD_MODES}
            selected={readAloudMode}
            labelOf={READ_ALOUD_MODE_LABEL}
            onSelect={(value) =>
              setChosen({ answerMethod, readAloudMode: value })
            }
          />
          {/* マイクの使用許可はこの画面では求めない（共通仕様 8章） */}
          <p className="text-note leading-[1.7] text-ink-muted">
            {ANSWER_METHOD_LABEL.voice}
            を選ぶとマイクの使用許可を求めます。
          </p>
        </div>
      }
      confirmLabel="チュートリアルを始める"
      confirmVariant="primary"
      onConfirm={() => {
        setChosen(null);
        router.push(`/tutorial/${answerMethod}?readAloud=${readAloudMode}`);
      }}
      onCancel={() => {
        setChosen(null);
        onCancel();
      }}
    />
  );
}
