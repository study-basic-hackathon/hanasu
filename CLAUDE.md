# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

「hanasu」はハッカソン用のプロジェクトで、音声会話を録音・文字起こしし、話し方(抑揚・フィラー・声量・テンポ)を分析して評価・アドバイスを返すサービスを想定している。

**現状はコード未実装の計画段階。** `backend/` `frontend/` `infra/` はすべて空(`.gitkeep` のみ)で、`documents/` 配下の設計ドキュメントが唯一の情報源。ビルド・テスト・lint コマンドはまだ存在しない。コードが追加されたら、この CLAUDE.md にコマンドを追記すること。

## 技術スタック(予定)

`documents/技術スタック.md` より:

- **バックエンド**: Go(`backend/` に配置)
- **フロントエンド**: TypeScript / Next.js(`frontend/` に配置、デプロイ先は Vercel)
- **インフラ**: AWS(`infra/` に配置)— ECS、ECR、Lambda、Chime SDK、RDS(企業情報・プロフィール)、Bedrock
- **音声認識**: Whisper を検討中
- 使わない想定: Cognito(認証は簡易的に実装)、S3

## 予定している API

`documents/必要api .md`(ファイル名に半角スペースを含む点に注意)より:

- 認証 API(ID/Password → 認証結果)
- 企業情報 CRUD API
- 音声認識 API(文字起こし + 音声分析: 抑揚・フィラー・声の大きさ・スピード)— 分割の可能性あり
- 内容評価 API(文字起こし・話し方情報 → 評価点数とアドバイス)
- 会話用 API(詳細未定)

制約: 認証済みユーザーのみ API 実行可能。

## リポジトリ構成

- `backend/` — Go バックエンド(未実装)
- `frontend/` — Next.js フロントエンド(未実装)
- `infra/` — AWS インフラコード(未実装)
- `documents/` — 設計ドキュメント(日本語)。`ADR/`(確定した意思決定)、`00_検討/`(検討記録)、`task-memo/`、`template/`、`frontend/01_design/`、`frontend/02_spec/` のサブディレクトリあり

## 規約

- ドキュメント・コミュニケーションは日本語
- コミットメッセージは `add:` `fix:` などのプレフィックス + 日本語の要約(例: `add: 必要API`)
- ブランチ名は  `feature/<内容>` 形式
- 設計検討の記録(ディスカッション記録)は `documents/00_検討/` に `YYYYMMDD_<トピック>.md` 形式で保存する
- 確定したアーキテクチャ上の意思決定は ADR として `documents/ADR/` に `NNNN-<トピック>.md` 形式(連番)で保存する。1 ADR = 1 決定。構成は `documents/ADR/0001-フロントエンド実行環境.md` を雛形とする
