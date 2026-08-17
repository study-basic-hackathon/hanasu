"use client";

import Link from "next/link";
import { useState } from "react";

import { PageContainer } from "@/components/layout/PageContainer";
import { buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { filledSections } from "@/lib/application";
import { MOCK_APPLICATIONS } from "@/mocks/applications";
import type { Application } from "@/mocks/types";

const COLUMNS = "grid-cols-[1fr_200px_150px]";

/** 「登録済みの情報」（S-06 3.1） */
function RegisteredInfo({ application }: { application: Application }) {
  const sections = filledSections(application);

  // 区分が1つだけなら `<区分名>のみ`、0なら `未入力`。どちらも注意色で示す
  if (sections.length <= 1) {
    return (
      <span className="text-note text-warning">
        {sections.length === 1 ? `${sections[0]}のみ` : "未入力"}
      </span>
    );
  }
  return (
    <span className="text-note text-ink-sub">{sections.join(" / ")}</span>
  );
}

/**
 * S-06 応募企業情報 一覧。追加・編集・削除の起点で、削除はこの画面で完結する。
 * モックでは API を呼ばず、画面内のダミーデータから消すだけ。
 */
export default function CompaniesPage() {
  const [applications, setApplications] = useState(MOCK_APPLICATIONS);
  const [pendingDelete, setPendingDelete] = useState<Application | null>(null);
  const [deletedName, setDeletedName] = useState<string | null>(null);

  function handleDelete() {
    if (!pendingDelete) return;
    setApplications((current) =>
      current.filter((application) => application.id !== pendingDelete.id),
    );
    setDeletedName(pendingDelete.company_name);
    setPendingDelete(null);
  }

  return (
    <PageContainer width={1080} className="flex flex-col gap-5">
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-heading font-bold">応募企業情報</h1>
          <p className="text-label text-ink-sub">
            企業ごとの情報と、応募者自身の経歴をまとめて登録します。質問の生成に使われます。
          </p>
        </div>
        <Link
          href="/companies/new"
          className={buttonClassName("primary", "sm", "text-body-sm")}
        >
          企業を追加
        </Link>
      </div>

      {/* 削除に成功したら一覧の上部に出す（S-06 5章） */}
      {deletedName && (
        <p className="rounded-control border border-accent/30 bg-accent-soft px-4 py-3 text-body-sm text-accent">
          {deletedName} を削除しました。
        </p>
      )}

      {applications.length === 0 ? (
        <Card className="flex flex-col items-start gap-5 px-6 py-10">
          <p className="text-body-sm text-ink-sub">
            登録された企業がありません。企業を追加すると、その内容をもとに面接の質問が作られます。
          </p>
          <Link href="/companies/new" className={buttonClassName("primary", "sm")}>
            企業を追加
          </Link>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div
            className={`grid ${COLUMNS} border-b border-line bg-[#fafbfb] px-6 py-3 text-note font-medium text-ink-sub`}
          >
            <span>企業名 / 職種</span>
            <span>登録済みの情報</span>
            <span className="text-right">操作</span>
          </div>
          {applications.map((application) => (
            <div
              key={application.id}
              className={`grid ${COLUMNS} items-center border-b border-divider px-6 py-[18px] text-body-sm last:border-b-0`}
            >
              <div className="flex flex-col gap-1">
                <span className="font-medium">{application.company_name}</span>
                {/* 職種が未入力なら企業名だけ（S-06 3章） */}
                {application.job_title && (
                  <span className="text-note text-ink-muted">
                    {application.job_title}
                  </span>
                )}
              </div>
              <RegisteredInfo application={application} />
              <div className="flex justify-end gap-4 text-label">
                <Link
                  href={`/companies/${application.id}/edit`}
                  className="text-accent hover:underline"
                >
                  編集
                </Link>
                <button
                  type="button"
                  onClick={() => setPendingDelete(application)}
                  className="text-danger hover:underline"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Link href="/" className="text-label text-accent hover:underline">
        ホームに戻る
      </Link>

      <ConfirmDialog
        open={pendingDelete !== null}
        message={`${pendingDelete?.company_name ?? ""} を削除します。登録した内容は元に戻せません。`}
        confirmLabel="削除する"
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </PageContainer>
  );
}
