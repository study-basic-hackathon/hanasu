const API_BASE_URL_ENV_NAME = "NEXT_PUBLIC_API_BASE_URL";

/**
 * ビルド時に設定されたバックエンド API のベース URL を返す。
 * エンドポイントのパスを安全に連結できるよう、末尾のスラッシュは除去する。
 */
export function getApiBaseUrl(): string {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const normalizedApiBaseUrl = apiBaseUrl?.replace(/\/+$/, "");

  if (!normalizedApiBaseUrl) {
    throw new Error(
      `${API_BASE_URL_ENV_NAME} が未設定です。バックエンド API のベース URL を設定してください。`,
    );
  }

  return normalizedApiBaseUrl;
}
