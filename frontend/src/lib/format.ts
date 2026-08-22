/**
 * 表記のきまり（共通仕様 10章）。
 * 時刻はブラウザのタイムゾーンで表示するため、日時を出す箇所では DateTime コンポーネントを使う。
 */

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** 一覧・詳細の日時: `YYYY-MM-DD HH:mm` */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** 会話中の時刻: `HH:mm` */
export function formatClock(iso: string): string {
  const date = new Date(iso);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 録音・経過時間: `mm:ss` */
export function formatElapsed(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** 話す速さ: `284 文字/分` */
export function formatSpeakingSpeed(charsPerMin: number): string {
  return `${Math.round(charsPerMin)} 文字/分`;
}

/** フィラー: `12 回`（毎分の値を渡すと `12 回 / 2.1 回/分`） */
export function formatFiller(count: number, perMinute?: number): string {
  const base = `${Math.round(count)} 回`;
  return perMinute === undefined
    ? base
    : `${base} / ${perMinute.toFixed(1)} 回/分`;
}

/** 件数: `12 件` */
export function formatCount(count: number): string {
  return `${count} 件`;
}
