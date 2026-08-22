"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { requestAccessToken } from "@/lib/auth-api";
import { storeAccessToken } from "@/lib/token-storage";

const INVALID_CREDENTIALS_MESSAGE = "ID またはパスワードが違います。";
const UNAVAILABLE_MESSAGE =
  "サインインできませんでした。時間をおいてもう一度お試しください。";

/**
 * S-01 サインイン。本サービスの唯一の入口で、ヘッダーを持たない。
 * 会員登録・パスワード再設定の導線は持たない（ADR-0011）。
 */
export default function SignInPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const submittingRef = useRef(false);

  // ID かパスワードが空のあいだは押せない。エラー文は出さない（S-01 4章）
  const canSubmit = userId.trim() !== "" && password !== "";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || submittingRef.current) return;

    submittingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await requestAccessToken(userId, password);
      if (!result.ok) {
        if (result.reason === "invalid-credentials") {
          setPassword("");
          setErrorMessage(INVALID_CREDENTIALS_MESSAGE);
        } else {
          setErrorMessage(UNAVAILABLE_MESSAGE);
        }
        return;
      }

      try {
        storeAccessToken(result.accessToken);
      } catch {
        setErrorMessage(UNAVAILABLE_MESSAGE);
        return;
      }
      router.push("/");
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
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
              disabled={isSubmitting}
            />
            <TextField
              label="パスワード"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isSubmitting}
            />
            {errorMessage && (
              <p role="alert" className="text-note text-danger">
                {errorMessage}
              </p>
            )}
            <Button
              type="submit"
              disabled={!canSubmit || isSubmitting}
              className="mt-1 w-full"
            >
              {isSubmitting ? "サインインしています" : "サインイン"}
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
