import { getApiBaseUrl } from "@/lib/api-url";

export type RequestAccessTokenResult =
  | { ok: true; accessToken: string }
  | { ok: false; reason: "invalid-credentials" | "unavailable" };

type AccessTokenResponse = {
  access_token: string;
  token_type: string;
};

function isAccessTokenResponse(value: unknown): value is AccessTokenResponse {
  if (typeof value !== "object" || value === null) return false;

  const response = value as Record<string, unknown>;
  return (
    typeof response.access_token === "string" &&
    response.access_token !== "" &&
    typeof response.token_type === "string" &&
    response.token_type.toLowerCase() === "bearer"
  );
}

/** 固定アカウントの資格情報を認証 API へ送り、画面で扱える結果へ正規化する。 */
export async function requestAccessToken(
  username: string,
  password: string,
): Promise<RequestAccessTokenResult> {
  const body = new URLSearchParams({ username, password });

  try {
    const response = await fetch(`${getApiBaseUrl()}/token`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (response.status === 400 || response.status === 401) {
      return { ok: false, reason: "invalid-credentials" };
    }
    if (!response.ok) {
      return { ok: false, reason: "unavailable" };
    }

    const payload: unknown = await response.json();
    if (!isAccessTokenResponse(payload)) {
      return { ok: false, reason: "unavailable" };
    }

    return { ok: true, accessToken: payload.access_token };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
