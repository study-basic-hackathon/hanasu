import { getApiBaseUrl } from "@/lib/api-url";
import { clearAccessToken, getAccessToken } from "@/lib/token-storage";

export const AUTH_REQUIRED_EVENT = "hanasu:auth-required";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ResponseType = "json" | "blob" | "none";

type ApiRequestOptions = {
  /** POST /token だけ false。 */
  authenticated?: boolean;
  responseType?: ResponseType;
};

function notifyAuthenticationRequired() {
  clearAccessToken();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
  }
}

async function readErrorDetail(response: Response): Promise<unknown> {
  const contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.includes("application/json")) return undefined;

  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/** API base URL、Bearer 認証、401、レスポンス形式を一か所で扱う。 */
export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  const authenticated = options.authenticated ?? true;
  const headers = new Headers(init.headers);
  headers.set("Accept", options.responseType === "blob" ? "audio/mpeg" : "application/json");

  if (authenticated) {
    const token = getAccessToken();
    if (!token) {
      notifyAuthenticationRequired();
      throw new ApiError("サインインが必要です。", 401);
    }
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, { ...init, headers });
  } catch (error) {
    throw new ApiError("API に接続できませんでした。", null, error);
  }

  if (response.status === 401) notifyAuthenticationRequired();

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new ApiError(
      `API が HTTP ${response.status} を返しました。`,
      response.status,
      detail,
    );
  }

  const responseType = options.responseType ?? "json";
  if (responseType === "none" || response.status === 204) {
    return undefined as T;
  }
  if (responseType === "blob") return (await response.blob()) as T;
  return (await response.json()) as T;
}

export function jsonRequest<T>(
  path: string,
  method: "POST" | "PUT" | "PATCH",
  body: unknown,
): Promise<T> {
  return apiRequest<T>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
