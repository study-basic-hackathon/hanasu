import type { Application } from "./types";

/**
 * 応募企業情報のダミーデータ（デザイン原本の S-06 に合わせた3件）。
 * 「登録済みの情報」の見え方を確かめられるよう、入力の埋まり具合を変えてある。
 */
export const MOCK_APPLICATIONS: Application[] = [
  {
    id: 1,
    company_name: "株式会社アルファテック",
    posting_url: "https://example.com/alphatech/jobs/backend",
    job_title: "バックエンドエンジニア",
    documents: "",
    motivation:
      "自社サービスの決済基盤を長く運用してきた点に惹かれています。前職で決済まわりの障害対応を担当し、止められない仕組みを作る難しさを知りました。同じ領域で腰を据えて改善に取り組みたいと考えています。",
    current_position: "株式会社サンプルウェブ / サーバーサイド開発",
    experience_years: 6,
    resume:
      "受注管理システムのリプレースでバックエンドのリーダーを担当。10名規模のチームで設計とレビューを担い、月間の障害件数を導入前の3分の1に減らしました。",
    note: "",
  },
  {
    id: 2,
    company_name: "ベータ工業株式会社",
    posting_url: "https://example.com/beta-kogyo/recruit/sys",
    job_title: "社内 SE",
    documents: "",
    motivation: "",
    current_position: "株式会社サンプルウェブ / サーバーサイド開発",
    experience_years: 6,
    resume:
      "社内の在庫管理ツールを内製で開発し、拠点ごとに分かれていた集計作業をまとめました。現場へのヒアリングから運用開始までを一人で担当しています。",
    note: "",
  },
  {
    id: 3,
    company_name: "ガンマソリューションズ",
    posting_url: "",
    job_title: "データエンジニア",
    documents: "",
    motivation: "",
    current_position: "株式会社サンプルウェブ / サーバーサイド開発",
    experience_years: 6,
    resume: "分析基盤のデータ取り込み処理を SQL とバッチで整備した経験があります。",
    note: "",
  },
];
