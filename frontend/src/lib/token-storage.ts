const ACCESS_TOKEN_STORAGE_KEY = "hanasu.accessToken";

function getSessionStorage(): Storage {
  if (typeof window === "undefined") {
    throw new Error("アクセストークンはブラウザ内でのみ保持できます。");
  }
  return window.sessionStorage;
}

/** ブラウザを閉じたときに破棄される sessionStorage へトークンを保持する。 */
export function storeAccessToken(accessToken: string): void {
  getSessionStorage().setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
}

/** 後続 API の Authorization ヘッダーに利用するトークンを返す。 */
export function getAccessToken(): string | null {
  return getSessionStorage().getItem(ACCESS_TOKEN_STORAGE_KEY);
}

/** サインアウトや認証切れのときにブラウザ内のトークンを破棄する。 */
export function clearAccessToken(): void {
  getSessionStorage().removeItem(ACCESS_TOKEN_STORAGE_KEY);
}
