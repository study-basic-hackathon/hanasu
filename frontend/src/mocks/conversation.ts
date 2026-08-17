import { FIRST_QUESTION } from "@/lib/interview";

/**
 * 会話ログのダミーデータ（デザイン原本の S-08）。
 * 会話履歴はクライアントが持つだけでサーバーには残らない（ADR-0008）。
 */

/** API の history と同じく role は assistant（面接官）/ user（自分） */
export type ChatTurn = {
  role: "assistant" | "user";
  content: string;
  /** 会話中の時刻 `HH:mm`（共通仕様 10章）。モックは表示用の文字列で持つ */
  time?: string;
  /** 音声で答えたターンだけが持つ（S-08 5章） */
  audio_seconds?: number;
  /** 文字起こし結果と文字入力のどちらからも数える */
  filler_count?: number;
};

/** 画面を開いた時点で3ターン目に入っている状態を見せる */
export const MOCK_INTERVIEW_TURNS: ChatTurn[] = [
  {
    role: "assistant",
    content: FIRST_QUESTION,
    time: "21:02",
  },
  {
    role: "user",
    content:
      "はい。現在は受託開発の会社で3年ほどバックエンドの開発を担当しています。えー、主に Python と AWS を使っていて、直近では請求管理のリニューアルでリードを務めました。",
    time: "21:03",
    audio_seconds: 42,
    filler_count: 2,
  },
  {
    role: "assistant",
    content:
      "請求管理のリニューアルでリードを務められたとのことですが、その中で最も判断が難しかった点と、どう決めたかを教えてください。",
    time: "21:04",
  },
];

/**
 * 回答を送ったときに返ってくる質問の見本。
 * 本来は POST /interviews/chat が返すもので、モックでは順に使う。
 */
export const MOCK_NEXT_QUESTIONS: string[] = [
  "その判断を進めるとき、周囲の合意はどのように取りましたか。反対意見があれば、それにどう応じたかも教えてください。",
  "リニューアルの効果はどのように測りましたか。数字で説明できるものがあれば挙げてください。",
  "チームで開発を進めるうえで、あなたが意識して続けていることは何ですか。",
  "これまでで最も失敗したと感じた仕事と、そこから変えた進め方を教えてください。",
  "当社を志望した理由を、いまのお仕事との違いに触れながら教えてください。",
  "入社後、最初の3か月で取り組みたいことがあれば教えてください。",
];
