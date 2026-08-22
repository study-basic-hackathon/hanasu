"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { PageContainer } from "@/components/layout/PageContainer";
import { Button, buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextArea, TextField } from "@/components/ui/TextField";
import type { Application } from "@/mocks/types";

import { resolveReturnTo } from "./returnTo";

type ApplicationFormProps = {
  /** 編集のときだけ渡す。無ければ新規登録 */
  application?: Application;
  /** 呼び出し元（S-05 または S-06）へ戻るためのパス */
  returnTo: string;
};

type ReturnAwareApplicationFormProps = Pick<
  ApplicationFormProps,
  "application"
>;

type FormValues = {
  company_name: string;
  posting_url: string;
  job_title: string;
  documents: string;
  motivation: string;
  current_position: string;
  experience_years: string;
  resume: string;
  note: string;
};

/** 充足度の分母は、企業名を除く8項目（S-07 4章） */
const OPTIONAL_FIELDS: { key: keyof FormValues; label: string }[] = [
  { key: "posting_url", label: "募集要項 URL" },
  { key: "job_title", label: "職種" },
  { key: "documents", label: "応募書類" },
  { key: "motivation", label: "志望動機" },
  { key: "current_position", label: "現職 / 直近の所属" },
  { key: "experience_years", label: "経験年数" },
  { key: "resume", label: "経歴・実績" },
  { key: "note", label: "備考" },
];

function toFormValues(application?: Application): FormValues {
  return {
    company_name: application?.company_name ?? "",
    posting_url: application?.posting_url ?? "",
    job_title: application?.job_title ?? "",
    documents: application?.documents ?? "",
    motivation: application?.motivation ?? "",
    current_position: application?.current_position ?? "",
    experience_years:
      application?.experience_years === null ||
      application?.experience_years === undefined
        ? ""
        : String(application.experience_years),
    resume: application?.resume ?? "",
    note: application?.note ?? "",
  };
}

/**
 * 静的出力後も `?from=` をブラウザで解決し、呼び出し元への戻り先を維持する。
 */
export function ReturnAwareApplicationForm({
  application,
}: ReturnAwareApplicationFormProps) {
  const searchParams = useSearchParams();

  return (
    <ApplicationForm
      application={application}
      returnTo={resolveReturnTo(searchParams.get("from") ?? undefined)}
    />
  );
}

type Errors = Partial<Record<keyof FormValues, string>>;

/**
 * S-07 応募企業情報 登録 / 編集。登録と編集で同じ画面を使う。
 * モックでは保存の API を呼ばず、検査を通ったら呼び出し元へ戻るだけ。
 */
export function ApplicationForm({
  application,
  returnTo,
}: ApplicationFormProps) {
  const router = useRouter();
  const isEdit = application !== undefined;
  const [values, setValues] = useState<FormValues>(() =>
    toFormValues(application),
  );
  const [errors, setErrors] = useState<Errors>({});
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
  const canSave = values.company_name.trim() !== "";

  function validate(): Errors {
    const next: Errors = {};
    if (values.company_name.trim() === "") {
      next.company_name = "企業名を入力してください。";
    }
    const url = values.posting_url.trim();
    if (url !== "" && !/^https?:\/\//.test(url)) {
      next.posting_url =
        "http:// または https:// で始まる URL を入力してください。";
    }
    const years = values.experience_years.trim();
    if (years !== "" && !/^\d{1,2}$/.test(years)) {
      next.experience_years = "0〜99 の数字で入力してください。";
    }
    return next;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    router.push(returnTo);
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
            <div className="grid grid-cols-[1fr_220px] gap-4">
              <TextField
                label="募集要項 URL"
                name="posting_url"
                inputMode="url"
                error={errors.posting_url}
                value={values.posting_url}
                onChange={(event) => update("posting_url", event.target.value)}
              />
              <TextField
                label="職種"
                name="job_title"
                value={values.job_title}
                onChange={(event) => update("job_title", event.target.value)}
              />
            </div>
            <TextArea
              label="応募書類（貼り付け）"
              name="documents"
              rows={5}
              placeholder="職務経歴書の本文をそのまま貼り付けてください。面接官の質問に反映されます。"
              value={values.documents}
              onChange={(event) => update("documents", event.target.value)}
            />
            <TextArea
              label="志望動機"
              name="motivation"
              rows={5}
              value={values.motivation}
              onChange={(event) => update("motivation", event.target.value)}
            />
          </Card>

          <Card className="flex flex-col gap-5 p-[26px]">
            <div className="flex flex-col gap-1.5 border-b border-divider pb-3.5">
              <h2 className="text-card-sm font-bold">応募者自身の情報</h2>
              <p className="text-note text-ink-muted">
                プロフィール登録は持たず、応募先ごとに書き分けます。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <TextField
                label="現職 / 直近の所属"
                name="current_position"
                value={values.current_position}
                onChange={(event) =>
                  update("current_position", event.target.value)
                }
              />
              <TextField
                label="経験年数"
                name="experience_years"
                inputMode="numeric"
                suffix="年"
                error={errors.experience_years}
                value={values.experience_years}
                onChange={(event) =>
                  update("experience_years", event.target.value)
                }
              />
            </div>
            <TextArea
              label="経歴・実績"
              name="resume"
              rows={4}
              value={values.resume}
              onChange={(event) => update("resume", event.target.value)}
            />
            <TextArea
              label="備考"
              name="note"
              rows={3}
              placeholder="面接で触れてほしくない話題などがあれば記入してください。"
              value={values.note}
              onChange={(event) => update("note", event.target.value)}
            />
          </Card>

          <div className="flex justify-end gap-3">
            {/* 入力の途中でも確認を出さない（S-07 6章） */}
            <Link
              href={returnTo}
              className={buttonClassName("secondary", "sm", "px-6 text-body-sm")}
            >
              取り消す
            </Link>
            <Button type="submit" disabled={!canSave} className="px-8">
              保存する
            </Button>
          </div>
        </form>

        <Card className="flex flex-col gap-3.5 p-[22px]">
          <h2 className="text-card-sm font-bold">入力のヒント</h2>
          <p className="text-note leading-[1.9] text-ink-sub">
            埋まっている項目が多いほど、面接官の質問が具体的になります。企業名以外は後から追記できます。
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
