/**
 * 面接の進行に関する値（S-08 の詳細仕様）。
 * サーバーは終了を判断しないため、ターン数の上限と最初の質問はフロントが持つ（ADR-0008）。
 */

/** ターン数の上限（本番モード） */
export const MAX_TURNS = 8;

/** チュートリアルは自己紹介1問で終わる（S-08 9章） */
export const TUTORIAL_MAX_TURNS = 1;

/** 最初の質問。POST /interviews/start を作らない場合はこの固定文字列を使う */
export const FIRST_QUESTION =
  "それでは始めます。まずは自己紹介をお願いします。これまでのご経歴と、現在のお仕事の内容を1分程度でお話しください。";

/** チュートリアルの質問は固定（S-08 9章） */
export const TUTORIAL_QUESTION = "1分で自己紹介してください。";

/** 無音での自動停止（秒）。無音がこの長さ続いたら停止して送信する（S-08 6.1） */
export const SILENCE_LIMIT_SECONDS = 3;

/** 1回の録音の最長（秒） */
export const RECORDING_MAX_SECONDS = 180;

/** 1回の録音の最短（秒）。これに満たないと送らない */
export const RECORDING_MIN_SECONDS = 1;

/**
 * フィラーとして数える語。
 * 本来は AmiVoice が `%えー%` の形で返したものを数える（ADR-0010）。
 * モックでは文字入力の回答からも数えられるよう、代表的な語を並べておく。
 */
const FILLER_WORDS = ["えー", "えっと", "あのー", "あの", "まあ", "そのー"];

export function countFillers(text: string): number {
  return FILLER_WORDS.reduce(
    (total, word) => total + text.split(word).length - 1,
    0,
  );
}
