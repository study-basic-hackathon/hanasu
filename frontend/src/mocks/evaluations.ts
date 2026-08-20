import type { Evaluation } from "./types";

/**
 * 評価結果のダミーデータ（デザイン原本の S-14 / S-16 に合わせた12件）。
 * 実施日時の新しい順に並べてある。企業ごとの件数は
 * アルファテック 6 / ベータ工業 3 / ガンマソリューションズ 1 / チュートリアル 2。
 * 評価が終わっていない結果（processing / failed）も S-16 の表示を確かめられるよう混ぜてある。
 */
/**
 * 面接を終えた直後に開く評価。
 * 評価は非同期のため、S-14 は処理中から始まる（ADR-0008）。
 */
export const MOCK_PENDING_EVALUATION_ID = 83;

export const MOCK_EVALUATIONS: Evaluation[] = [
  {
    evaluation_id: 87,
    company_id: 1,
    company_name: "株式会社アルファテック",
    question_strength: "standard",
    answer_method: "voice",
    turn_count: 8,
    status: "completed",
    created_at: "2026-08-17T21:14:00+09:00",
    total_score: 78,
    scores: {
      speaking_speed: { score: 72, value: 284, unit: "文字/分" },
      filler: { score: 64, value: 12, unit: "回", value_per_minute: 2.1 },
      structure_content: {
        score: 85,
        comment: "結論から述べる形が保たれています。",
      },
    },
    advice: [
      "具体的な数字が出てくるまでに時間がかかる回答が3件ありました。固有名詞を挙げたあと、規模と担当範囲を1文で添えてください。",
      "フィラーは考えている間に出ています。話し始める前に2秒置く方が落ち着いて聞こえます。",
    ],
  },
  {
    evaluation_id: 86,
    company_id: 1,
    company_name: "株式会社アルファテック",
    question_strength: "hard",
    answer_method: "voice",
    turn_count: 8,
    status: "completed",
    created_at: "2026-08-16T21:04:00+09:00",
    total_score: 71,
    scores: {
      speaking_speed: { score: 66, value: 271, unit: "文字/分" },
      filler: { score: 52, value: 18, unit: "回", value_per_minute: 2.8 },
      structure_content: {
        score: 79,
        comment: "質問の意図には答えられていますが、前置きが長い回答があります。",
      },
    },
    advice: [
      "深掘りの質問に対して、まず一言で答えてから背景を足すと伝わりやすくなります。",
    ],
  },
  {
    evaluation_id: 85,
    company_id: 2,
    company_name: "ベータ工業株式会社",
    question_strength: "easy",
    answer_method: "text",
    turn_count: 6,
    status: "completed",
    created_at: "2026-08-14T09:32:00+09:00",
    total_score: 65,
    scores: {
      speaking_speed: { score: 58, value: 262, unit: "文字/分" },
      filler: { score: 61, value: 15, unit: "回", value_per_minute: 2.4 },
      structure_content: {
        score: 74,
        comment: "具体例は挙げられていますが、結論が後半に来ています。",
      },
    },
    advice: [
      "「結論 → 理由 → 具体例」の順で話すと伝わりやすくなります。",
      "担当した範囲と、自分で判断した部分を分けて話してください。",
    ],
  },
  {
    evaluation_id: 84,
    company_id: null,
    company_name: null,
    question_strength: null,
    answer_method: "voice",
    turn_count: 1,
    status: "completed",
    created_at: "2026-08-11T18:20:00+09:00",
    total_score: 54,
    scores: {
      speaking_speed: { score: 48, value: 248, unit: "文字/分" },
      filler: { score: 41, value: 9, unit: "回", value_per_minute: 3.6 },
      structure_content: {
        score: 66,
        comment: "自己紹介の要素は揃っていますが、順序が入れ替わっています。",
      },
    },
    advice: ["名前・経験・強みの順に並べると、1分でも収まります。"],
  },
  {
    evaluation_id: 83,
    company_id: 1,
    company_name: "株式会社アルファテック",
    question_strength: "standard",
    answer_method: "voice",
    turn_count: 8,
    status: "processing",
    created_at: "2026-08-10T20:15:00+09:00",
    total_score: null,
    scores: null,
    advice: [],
  },
  {
    evaluation_id: 82,
    company_id: 3,
    company_name: "ガンマソリューションズ",
    question_strength: "standard",
    answer_method: "voice",
    turn_count: 7,
    status: "completed",
    created_at: "2026-08-09T13:40:00+09:00",
    total_score: 62,
    scores: {
      speaking_speed: { score: 55, value: 258, unit: "文字/分" },
      filler: { score: 58, value: 16, unit: "回", value_per_minute: 2.6 },
      structure_content: {
        score: 70,
        comment: "経歴の説明は十分ですが、志望動機の根拠が薄いです。",
      },
    },
    advice: ["志望動機は、応募先の事業と自分の経験の接点から話してください。"],
  },
  {
    evaluation_id: 81,
    company_id: 2,
    company_name: "ベータ工業株式会社",
    question_strength: "hard",
    answer_method: "text",
    turn_count: 5,
    status: "failed",
    created_at: "2026-08-08T19:05:00+09:00",
    total_score: null,
    scores: null,
    advice: [],
  },
  {
    evaluation_id: 80,
    company_id: 1,
    company_name: "株式会社アルファテック",
    question_strength: "standard",
    answer_method: "voice",
    turn_count: 8,
    status: "completed",
    created_at: "2026-08-07T21:30:00+09:00",
    total_score: 69,
    scores: {
      speaking_speed: { score: 70, value: 279, unit: "文字/分" },
      filler: { score: 60, value: 17, unit: "回", value_per_minute: 2.5 },
      structure_content: {
        score: 76,
        comment: "話の筋は通っていますが、1つの回答が長くなりがちです。",
      },
    },
    advice: ["1つの回答は40秒を目安にまとめてください。"],
  },
  {
    evaluation_id: 79,
    company_id: null,
    company_name: null,
    question_strength: null,
    answer_method: "voice",
    turn_count: 1,
    status: "completed",
    created_at: "2026-08-05T12:10:00+09:00",
    total_score: 47,
    scores: {
      speaking_speed: { score: 44, value: 241, unit: "文字/分" },
      filler: { score: 38, value: 11, unit: "回", value_per_minute: 4.2 },
      structure_content: {
        score: 58,
        comment: "強みの説明が抽象的で、根拠が示されていません。",
      },
    },
    advice: ["強みは、それが表れた出来事とセットで話してください。"],
  },
  {
    evaluation_id: 78,
    company_id: 1,
    company_name: "株式会社アルファテック",
    question_strength: "easy",
    answer_method: "text",
    turn_count: 6,
    status: "completed",
    created_at: "2026-08-03T20:48:00+09:00",
    total_score: 58,
    scores: {
      speaking_speed: { score: 52, value: 254, unit: "文字/分" },
      filler: { score: 47, value: 21, unit: "回", value_per_minute: 3.1 },
      structure_content: {
        score: 68,
        comment: "質問に対する答えが先に来ている回答と、そうでない回答が混ざっています。",
      },
    },
    advice: ["答えを先に置く形に統一すると、印象が安定します。"],
  },
  {
    evaluation_id: 77,
    company_id: 2,
    company_name: "ベータ工業株式会社",
    question_strength: "standard",
    answer_method: "voice",
    turn_count: 7,
    status: "completed",
    created_at: "2026-08-02T10:22:00+09:00",
    total_score: 61,
    scores: {
      speaking_speed: { score: 63, value: 268, unit: "文字/分" },
      filler: { score: 49, value: 20, unit: "回", value_per_minute: 3.0 },
      structure_content: {
        score: 70,
        comment: "現場での工夫が具体的に語れています。",
      },
    },
    advice: ["フィラーが増える場面が決まっています。詰まったら一度黙ってください。"],
  },
  {
    evaluation_id: 76,
    company_id: 1,
    company_name: "株式会社アルファテック",
    question_strength: "standard",
    answer_method: "voice",
    turn_count: 8,
    status: "completed",
    created_at: "2026-07-31T21:02:00+09:00",
    total_score: 52,
    scores: {
      speaking_speed: { score: 49, value: 246, unit: "文字/分" },
      filler: { score: 44, value: 24, unit: "回", value_per_minute: 3.4 },
      structure_content: {
        score: 62,
        comment: "経歴の羅列にとどまり、担当した範囲が読み取れません。",
      },
    },
    advice: [
      "プロジェクトの規模と、自分が担当した範囲を数字で添えてください。",
    ],
  },
];
