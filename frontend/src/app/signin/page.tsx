"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";

/**
 * S-01 サインイン。本サービスの唯一の入口で、ヘッダーを持たない。
 * 会員登録・パスワード再設定の導線は持たない（ADR-0011）。
 */
export default function SignInPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");

  // ID かパスワードが空のあいだは押せない。エラー文は出さない（S-01 4章）
  const canSubmit = userId.trim() !== "" && password !== "";

  // モックでは POST /token を呼ばず、そのまま S-04 へ移る。
  // 送信中の表示と認証失敗の表示は、API 連携のときに入れる（S-01 6章）
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    router.push("/");
  }

  return (
    <main className="flex flex-1 items-center justify-center">
      <div className="flex w-[420px] flex-col items-center gap-7">
        <div className="flex flex-col items-center gap-2">
          <div className="text-[30px] font-bold tracking-[0.14em]">hanasu</div>
          <p className="text-body-sm text-ink-sub">
            AI 面接官と話して、話し方を測る
          </p>
        </div>
        <Card className="w-full p-8">
          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            <TextField
              label="ID"
              name="userId"
              autoComplete="username"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
            />
            <TextField
              label="パスワード"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Button type="submit" disabled={!canSubmit} className="mt-1 w-full">
              サインイン
            </Button>
            <p className="border-t border-divider pt-4 text-note leading-[1.7] text-ink-muted">
              配布された ID
              とパスワードでサインインしてください。会員登録・パスワード再設定は用意していません。
            </p>
          </form>
        </Card>
      </div>
    </main>
  );
}
