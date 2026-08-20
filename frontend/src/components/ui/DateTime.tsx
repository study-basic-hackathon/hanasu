import { formatDateTime } from "@/lib/format";

type DateTimeProps = {
  /** ISO 8601 の日時 */
  value: string;
  className?: string;
};

/**
 * 日時の表示（共通仕様 10章）。
 * ブラウザのタイムゾーンで表示するため、サーバーで描いた文字列とは食い違う。
 * その差はハイドレーション時に上書きさせる。
 */
export function DateTime({ value, className }: DateTimeProps) {
  return (
    <time dateTime={value} className={className} suppressHydrationWarning>
      {formatDateTime(value)}
    </time>
  );
}
