"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { AUTH_REQUIRED_EVENT } from "@/lib/api-client";
import type { SignedInUser } from "@/lib/domain";
import { clearAccessToken, getAccessToken } from "@/lib/token-storage";
import { getCurrentUser } from "@/lib/user-api";

type AuthContextValue = {
  user: SignedInUser | null;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth は AuthProvider の内側で使用してください。");
  return value;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isSignIn = pathname === "/signin";
  const [user, setUser] = useState<SignedInUser | null>(null);

  const moveToSignIn = useCallback(() => {
    clearAccessToken();
    setUser(null);
    if (pathname !== "/signin") router.replace("/signin");
  }, [pathname, router]);

  useEffect(() => {
    window.addEventListener(AUTH_REQUIRED_EVENT, moveToSignIn);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, moveToSignIn);
  }, [moveToSignIn]);

  useEffect(() => {
    if (isSignIn) return;
    if (!getAccessToken()) {
      const timer = window.setTimeout(moveToSignIn, 0);
      return () => window.clearTimeout(timer);
    }
    if (user) {
      return;
    }

    const controller = new AbortController();
    getCurrentUser(controller.signal)
      .then((currentUser) => {
        setUser(currentUser);
      })
      .catch(() => {
        if (!controller.signal.aborted) moveToSignIn();
      });
    return () => controller.abort();
  }, [isSignIn, moveToSignIn, user]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, signOut: moveToSignIn }),
    [moveToSignIn, user],
  );

  if (!isSignIn && !user) {
    return (
      <main className="grid min-h-dvh place-items-center text-body-sm text-ink-sub">
        サインイン状態を確認しています
      </main>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
