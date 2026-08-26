"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { PageContainer } from "@/components/layout/PageContainer";
import { Card } from "@/components/ui/Card";
import { getCompany, type Company } from "@/lib/company-api";

import { ApplicationForm } from "./ApplicationForm";
import { resolveReturnTo } from "./returnTo";

export function CompanyEditPage() {
  const searchParams = useSearchParams();
  const id = Number(searchParams.get("id"));
  const returnTo = resolveReturnTo(searchParams.get("from") ?? undefined);
  const [company, setCompany] = useState<Company | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isSafeInteger(id) || id <= 0) return;
    const controller = new AbortController();
    getCompany(id, controller.signal)
      .then(setCompany)
      .catch(() => {
        if (!controller.signal.aborted) {
          setError("応募企業情報を取得できませんでした。");
        }
      });
    return () => controller.abort();
  }, [id]);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return <ErrorCard message="企業 ID が指定されていません。" />;
  }
  if (error) return <ErrorCard message={error} />;
  if (!company) {
    return (
      <PageContainer width={1000} className="text-body-sm text-ink-sub">
        応募企業情報を読み込んでいます。
      </PageContainer>
    );
  }

  return <ApplicationForm company={company} returnTo={returnTo} />;
}

function ErrorCard({ message }: { message: string }) {
  return (
    <PageContainer width={1000} className="grid place-items-center">
      <Card className="flex w-[440px] flex-col items-center gap-4 px-10 py-8">
        <h1 className="text-card font-bold">応募企業情報を開けません</h1>
        <p role="alert" className="text-label text-danger">{message}</p>
        <Link href="/companies" className="text-label text-accent hover:underline">
          一覧に戻る
        </Link>
      </Card>
    </PageContainer>
  );
}
