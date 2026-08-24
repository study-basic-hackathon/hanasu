"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PageContainer } from "@/components/layout/PageContainer";
import { buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  deleteCompany,
  listCompanies,
  type Company,
} from "@/lib/company-api";

const COLUMNS = "grid-cols-[1fr_200px_150px]";

/** 「登録済みの情報」（S-06 3.1） */
function RegisteredInfo({ company }: { company: Company }) {
  const sections = [
    company.company_url ? "募集要項" : null,
    company.motivation ? "志望動機" : null,
    company.resume ? "経歴" : null,
    company.note ? "備考" : null,
  ].filter((section): section is string => section !== null);

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
 * 一覧取得と削除を応募企業 API へ接続し、成功後に画面の一覧を更新する。
 */
export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [pendingDelete, setPendingDelete] = useState<Company | null>(null);
  const [deletedName, setDeletedName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    listCompanies(controller.signal)
      .then((loaded) => {
        setCompanies(loaded);
        setLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError("応募企業情報を取得できませんでした。時間をおいて再読み込みしてください。");
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, []);

  async function handleDelete() {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteCompany(pendingDelete.id);
      setCompanies((current) =>
        current.filter((company) => company.id !== pendingDelete.id),
      );
      setDeletedName(pendingDelete.company_name);
      setPendingDelete(null);
    } catch {
      setError("削除できませんでした。時間をおいてもう一度お試しください。");
    } finally {
      setDeleting(false);
    }
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

      {error && (
        <p role="alert" className="rounded-control border border-danger/30 bg-danger/5 px-4 py-3 text-body-sm text-danger">
          {error}
        </p>
      )}

      {loading ? (
        <Card className="px-6 py-10 text-body-sm text-ink-sub">
          応募企業情報を読み込んでいます。
        </Card>
      ) : companies.length === 0 ? (
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
          {companies.map((company) => (
            <div
              key={company.id}
              className={`grid ${COLUMNS} items-center border-b border-divider px-6 py-[18px] text-body-sm last:border-b-0`}
            >
              <div className="flex flex-col gap-1">
                <span className="font-medium">{company.company_name}</span>
              </div>
              <RegisteredInfo company={company} />
              <div className="flex justify-end gap-4 text-label">
                <Link
                  href={`/companies/edit?id=${company.id}`}
                  className="text-accent hover:underline"
                >
                  編集
                </Link>
                <button
                  type="button"
                  onClick={() => setPendingDelete(company)}
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
        onCancel={() => !deleting && setPendingDelete(null)}
      />
    </PageContainer>
  );
}
