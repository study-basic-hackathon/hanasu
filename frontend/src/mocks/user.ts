/**
 * サインイン中のユーザー。
 * 会員登録は作らず、固定の ID / パスワード1組を使う（ADR-0011）。
 */
export const MOCK_SIGNED_IN_USER = {
  username: "user01",
} as const;
