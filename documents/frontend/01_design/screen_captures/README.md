# 画面モックのキャプチャ

**画面モックを実装した時点の画面を撮ったもの。** 実装は [#51](https://github.com/study-basic-hackathon/hanasu/issues/51)・[#2](https://github.com/study-basic-hackathon/hanasu/issues/2)・[#52](https://github.com/study-basic-hackathon/hanasu/issues/52)〜[#62](https://github.com/study-basic-hackathon/hanasu/issues/62) による。

**見た目の正本は [デザイン原本](../screen_design.html)、文言・表示項目の正本は [共通仕様](../screen_common.md) と [画面詳細仕様](../screens/) である。** 本ディレクトリは実装後の状態を残したものであり、正本ではない。仕様と食い違うときは仕様側を採る。

## 撮影の条件

| 項目 | 値 |
|---|---|
| ビューポート | 1440 × 900（基準幅。[共通仕様](../screen_common.md) 3章） |
| 解像度 | 2倍（Retina 相当） |
| タイムゾーン | Asia/Tokyo |
| データ | `frontend/src/mocks/` のダミーデータ |

縦に長い画面（`05` / `06` / `18`）はページ全体を1枚に収めている。

## 一覧

| ファイル | 画面 | パス |
|---|---|---|
| `01-S-01-signin.png` | S-01 サインイン | `/signin` |
| `02-S-04-home.png` | S-04 ホーム | `/` |
| `03-S-05-practice-setup.png` | S-05 練習の設定 | `/practice/setup` |
| `04-S-06-companies.png` | S-06 応募企業情報 一覧 | `/companies` |
| `05-S-07-company-new.png` | S-07 新規登録 | `/companies/new` |
| `06-S-07-company-edit.png` | S-07 編集 | `/companies/[id]/edit` |
| `07-S-08-interview.png` | S-08 本番モード（待機） | `/interview` |
| `08-S-08-recording.png` | S-08 本番モード（録音中・無音の経過） | `/interview` |
| `09-S-03-tutorial.png` | S-03 チュートリアル | `/tutorial` |
| `10-S-09-practice-menu.png` | S-09 練習メニュー | `/practice` |
| `11-S-10-reading.png` | S-10 音読評価 | `/practice/reading` |
| `12-S-11-articulation.png` | S-11 滑舌練習 | `/practice/articulation` |
| `13-S-12-speed.png` | S-12 スピード測定 | `/practice/speed` |
| `14-S-13-qa.png` | S-13 一問一答評価 | `/practice/qa` |
| `15-S-14-completed.png` | S-14 評価（完了） | `/evaluations/87` |
| `16-S-14-processing.png` | S-14 評価（処理中） | `/evaluations/83` |
| `17-S-14-failed.png` | S-14 評価（失敗） | `/evaluations/81?from=interview` |
| `18-S-16-evaluations.png` | S-16 履歴一覧 | `/evaluations` |

## 動画

`screen_flow_walkthrough.mp4`（1分10秒 / 音声なし）は主要な導線を通しで操作したもの。サインイン → ホーム → 練習の設定 → 本番モード（文字入力と音声の両方で回答）→ 評価 → 履歴 → 評価詳細 → 応募企業情報（編集・削除の確認）→ チュートリアル → 練習モードの順に移る。**画面のつながりは [画面遷移図](../screen_flow.md) が正本である。**
