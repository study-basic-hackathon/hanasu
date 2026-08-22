/** クラス名を結合する。false / null / undefined は捨てる */
export function cn(
  ...classes: (string | false | null | undefined)[]
): string {
  return classes.filter(Boolean).join(" ");
}
