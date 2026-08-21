"use client";

import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";

import { cn } from "@/lib/cn";

type FieldFrameProps = {
  label: string;
  /** ラベルの右に `必須` を赤字で添える（S-07 3.1） */
  required?: boolean;
  /** 入力の誤り。欄を赤枠にし、直下に赤字で理由を出す（共通仕様 7.2） */
  error?: string;
  /** 欄の直下に添える補足 */
  hint?: ReactNode;
  className?: string;
  children: (inputProps: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": boolean | undefined;
  }) => ReactNode;
};

/** ラベル・必須・エラー・補足の並べ方を入力欄で共通にする */
function FieldFrame({
  label,
  required,
  error,
  hint,
  className,
  children,
}: FieldFrameProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={cn("flex flex-col gap-[7px]", className)}>
      <label
        htmlFor={id}
        className="flex items-center gap-2 text-label font-medium text-ink-label"
      >
        {label}
        {required && <span className="text-note text-danger">必須</span>}
      </label>
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}
      {error ? (
        <p id={`${id}-error`} className="text-note text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-note text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const CONTROL_CLASS =
  "w-full rounded-control border bg-surface px-3 text-body text-ink placeholder:text-ink-muted focus:outline-2 focus:outline-offset-[-1px] focus:outline-accent";

function borderClass(error: string | undefined): string {
  return error ? "border-danger" : "border-line-strong";
}

type TextFieldProps = Omit<ComponentProps<"input">, "id"> & {
  label: string;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  /** 入力欄の右端に添える単位（例: `年`） */
  suffix?: string;
  /** 外枠（ラベルを含む領域）に当てるクラス */
  fieldClassName?: string;
};

/** 1行の入力欄（共通仕様 11.3: 高さ 42px・角丸 4px） */
export function TextField({
  label,
  required,
  error,
  hint,
  suffix,
  fieldClassName,
  className,
  ...props
}: TextFieldProps) {
  return (
    <FieldFrame
      label={label}
      required={required}
      error={error}
      hint={hint}
      className={fieldClassName}
    >
      {(inputProps) => {
        const input = (
          <input
            {...inputProps}
            {...props}
            className={cn(
              CONTROL_CLASS,
              "h-field",
              borderClass(error),
              suffix && "pr-9",
              className,
            )}
          />
        );
        return suffix ? (
          <div className="relative">
            {input}
            <span className="absolute top-1/2 right-3 -translate-y-1/2 text-label text-ink-muted">
              {suffix}
            </span>
          </div>
        ) : (
          input
        );
      }}
    </FieldFrame>
  );
}

type TextAreaProps = Omit<ComponentProps<"textarea">, "id"> & {
  label: string;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  fieldClassName?: string;
};

/** 複数行の入力欄 */
export function TextArea({
  label,
  required,
  error,
  hint,
  fieldClassName,
  className,
  rows = 4,
  ...props
}: TextAreaProps) {
  return (
    <FieldFrame
      label={label}
      required={required}
      error={error}
      hint={hint}
      className={fieldClassName}
    >
      {(inputProps) => (
        <textarea
          {...inputProps}
          {...props}
          rows={rows}
          className={cn(
            CONTROL_CLASS,
            "resize-y py-2.5 leading-[1.8]",
            borderClass(error),
            className,
          )}
        />
      )}
    </FieldFrame>
  );
}
