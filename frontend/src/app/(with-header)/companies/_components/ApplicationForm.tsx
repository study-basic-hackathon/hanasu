"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { PageContainer } from "@/components/layout/PageContainer";
import { Button, buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextArea, TextField } from "@/components/ui/TextField";
import { ApiError } from "@/lib/api-client";
import {
  createCompany,
  updateCompany,
  type Company,
} from "@/lib/company-api";

import { resolveReturnTo } from "./returnTo";

type ApplicationFormProps = {
  /** 編集のときだけ渡す。無ければ新規登録 */
  company?: Company;
  /** 呼び出し元（S-05 または S-06）へ戻るためのパス */
  returnTo: string;
};

type ReturnAwareApplicationFormProps = Pick<
  ApplicationFormProps,
  "company"
>;

type FormValues = {
  company_name: string;
  company_url: string;
  motivation: string;
  resume: string;
  note: string;
  job_summary: string;
};

/** 充足度の分母は、必須の企業名・志望動機を除く4項目（S-07 4章） */
const OPTIONAL_FIELDS: { key: keyof FormValues; label: string }[] = [
  { key: "company_url", label: "募集要項 URL" },
  { key: "job_summary", label: "募集要項の要約" },
  { key: "resume", label: "経歴・実績" },
  { key: "note", label: "備考" },
];

const FIELD_MAX_LENGTHS: Record<keyof FormValues, number> = {
  company_name: 100,
  company_url: 2_048,
  motivation: 4_000,
  resume: 10_000,
  note: 2_000,
  job_summary: 4_000,
};

const FIELD_LABELS: Record<keyof FormValues, string> = {
  company_name: "企業名",
  company_url: "募集要項 URL",
  motivation: "志望動機",
  resume: "経歴・実績",
  note: "備考",
  job_summary: "募集要項の要約",
};

function toFormValues(company?: Company): FormValues {
  return {
    company_name: company?.company_name ?? "",
    company_url: company?.company_url ?? "",
    motivation: company?.motivation ?? "",
    resume: company?.resume ?? "",
    note: company?.note ?? "",
    job_summary: company?.job_summary ?? "",
  };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname !== ""
    );
  } catch {
    return false;
  }
}

/**
 * 静的出力後も `?from=` をブラウザで解決し、呼び出し元への戻り先を維持する。
 */
export function ReturnAwareApplicationForm({
  company,
}: ReturnAwareApplicationFormProps) {
  const searchParams = useSearchParams();

  return (
    <ApplicationForm
      company={company}
      returnTo={resolveReturnTo(searchParams.get("from") ?? undefined)}
    />
  );
}

type Errors = Partial<Record<keyof FormValues, string>>;

/**
 * S-07 応募企業情報 登録 / 編集。登録と編集で同じ画面を使う。
 * 現在のバックエンドが受け付ける項目を保存し、成功後に呼び出し元へ戻る。
 */
export function ApplicationForm({
  company,
  returnTo,
}: ApplicationFormProps) {
  const router = useRouter();
  const isEdit = company !== undefined;
  const [values, setValues] = useState<FormValues>(() =>
    toFormValues(company),
  );
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function update(key: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  // 空白だけの入力は未入力として数える（S-07 4章）
  const filledCount = useMemo(
    () =>
      OPTIONAL_FIELDS.filter(({ key }) => values[key].trim() !== "").length,
    [values],
  );
  const emptyLabels = OPTIONAL_FIELDS.filter(
    ({ key }) => values[key].trim() === "",
  ).map(({ label }) => label);

  // 企業名が空のあいだは「保存する」を押せなくする（S-07 5章）
  const canSave =
    values.company_name.trim() !== "" && values.motivation.trim() !== "";

  function validate(): Errors {
    const next: Errors = {};
    if (values.company_name.trim() === "") {
      next.company_name = "企業名を入力してください。";
    }
    if (values.motivation.trim() === "") {
      next.motivation = "志望動機を入力してください。";
    }
    for (const key of Object.keys(FIELD_MAX_LENGTHS) as (keyof FormValues)[]) {
      const maxLength = FIELD_MAX_LENGTHS[key];
      if (values[key].trim().length > maxLength) {
        next[key] = `${FIELD_LABELS[key]}は${maxLength.toLocaleString()}文字以内で入力してください。`;
      }
    }
    const url = values.company_url.trim();
    if (url !== "" && next.company_url === undefined && !isHttpUrl(url)) {
      next.company_url =
        "http:// または https:// で始まる URL を入力してください。";
    }
    return next;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      // 最初の誤りの位置まで画面を送る（S-07 5章）
      const firstKey = Object.keys(found)[0];
      formRef.current
        ?.querySelector<HTMLElement>(`[name="${firstKey}"]`)
        ?.scrollIntoView({ block: "center" });
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const input = {
        company_name: values.company_name.trim(),
        motivation: values.motivation.trim(),
        company_url: values.company_url.trim() || null,
        resume: values.resume.trim() || null,
        note: values.note.trim() || null,
        job_summary: values.job_summary.trim() || null,
      };
      if (company) await updateCompany(company.id, input);
      else await createCompany(input);
      router.push(returnTo);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setErrors((current) => ({
          ...current,
          company_name: "この企業名はすでに登録されています。",
        }));
      } else {
        setSubmitError("保存できませんでした。時間をおいてもう一度お試しください。");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageContainer width={1000} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <span className="text-label text-ink-muted">
          応募企業情報 / {isEdit ? "編集" : "新規登録"}
        </span>
        {/* 編集では企業名を見出しにする。未入力なら `新規登録`（S-07 2章） */}
        <h1 className="text-heading font-bold">
          {isEdit && values.company_name.trim() !== ""
            ? values.company_name
            : "新規登録"}
        </h1>
      </div>

      <div className="grid grid-cols-[1fr_300px] items-start gap-6">
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="flex flex-col gap-5"
        >
          <Card className="flex flex-col gap-5 p-[26px]">
            <h2 className="border-b border-divider pb-3.5 text-card-sm font-bold">
              企業の情報
            </h2>
            <TextField
              label="企業名"
              name="company_name"
              required
              error={errors.company_name}
              value={values.company_name}
              onChange={(event) => update("company_name", event.target.value)}
            />
            <TextField
              label="募集要項 URL"
              name="company_url"
              inputMode="url"
              error={errors.company_url}
              value={values.company_url}
              onChange={(event) => update("company_url", event.target.value)}
            />
            <TextArea
              label="募集要項の要約"
              name="job_summary"
              rows={5}
              error={errors.job_summary}
              value={values.job_summary}
              onChange={(event) => update("job_summary", event.target.value)}
            />
          </Card>

          <Card className="flex flex-col gap-5 p-[26px]">
            <div className="flex flex-col gap-1.5 border-b border-divider pb-3.5">
              <h2 className="text-card-sm font-bold">応募者自身の情報</h2>
              <p className="text-note text-ink-muted">
                プロフィール登録は持たず、応募先ごとに書き分けます。
              </p>
            </div>
            <TextArea
              label="志望動機"
              name="motivation"
              required
              error={errors.motivation}
              rows={5}
              value={values.motivation}
              onChange={(event) => update("motivation", event.target.value)}
            />
            <TextArea
              label="経歴・実績"
              name="resume"
              rows={4}
              error={errors.resume}
              value={values.resume}
              onChange={(event) => update("resume", event.target.value)}
            />
            <TextArea
              label="備考"
              name="note"
              rows={3}
              error={errors.note}
              placeholder="面接で触れてほしくない話題などがあれば記入してください。"
              value={values.note}
              onChange={(event) => update("note", event.target.value)}
            />
          </Card>

          <div className="flex justify-end gap-3">
            {submitError && (
              <p role="alert" className="mr-auto self-center text-note text-danger">
                {submitError}
              </p>
            )}
            {/* 入力の途中でも確認を出さない（S-07 6章） */}
            <Link
              href={returnTo}
              className={buttonClassName("secondary", "sm", "px-6 text-body-sm")}
            >
              取り消す
            </Link>
            <Button type="submit" disabled={!canSave || submitting} className="px-8">
              {submitting ? "保存しています" : "保存する"}
            </Button>
          </div>
        </form>

        <Card className="flex flex-col gap-3.5 p-[22px]">
          <h2 className="text-card-sm font-bold">入力のヒント</h2>
          <p className="text-note leading-[1.9] text-ink-sub">
            埋まっている項目が多いほど、面接官の質問が具体的になります。企業名と志望動機以外は後から追記できます。
          </p>
          <div className="flex flex-col gap-2.5 border-t border-divider pt-3.5">
            <div className="flex justify-between text-label">
              <span className="text-ink-label">入力の充足</span>
              <span className="font-bold">
                {filledCount} / {OPTIONAL_FIELDS.length}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-chip bg-track">
              <div
                className="h-full rounded-chip bg-accent"
                style={{
                  width: `${(filledCount / OPTIONAL_FIELDS.length) * 100}%`,
                }}
              />
            </div>
            {/* すべて入力済みなら出さない（S-07 4章） */}
            {emptyLabels.length > 0 && (
              <p className="text-note leading-[1.8] text-ink-muted">
                未入力：{emptyLabels.join("、")}
              </p>
            )}
          </div>
          <p className="border-t border-divider pt-3.5 text-note leading-[1.8] text-ink-muted">
            この情報は評価には使われず、質問の生成にのみ使われます。
          </p>
        </Card>
      </div>
    </PageContainer>
  );
}
