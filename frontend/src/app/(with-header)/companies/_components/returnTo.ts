/**
 * S-07 の戻り先（S-05 または S-06）。
 * 呼び出し元は `?from=` で渡す。指定がなければ S-06 の一覧に戻る。
 */
export function resolveReturnTo(from: string | string[] | undefined): string {
  // 外部のパスへ飛ばさないよう、アプリ内のパスだけを受け付ける
  if (typeof from === "string" && from.startsWith("/") && !from.startsWith("//")) {
    return from;
  }
  return "/companies";
}
