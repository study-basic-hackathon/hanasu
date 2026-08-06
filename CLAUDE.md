# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

「hanasu」はハッカソン用のプロジェクトで、音声会話を録音・文字起こしし、話し方(抑揚・フィラー・声量・テンポ)を分析して評価・アドバイスを返すサービスを想定している。

**`frontend/` は Next.js プロジェクトを作成済み(2026-08-06)。`backend/` `infra/` は未実装(空)。** 未実装部分については `documents/` 配下の設計ドキュメントが唯一の情報源。コードが追加されたら、この CLAUDE.md にコマンドを追記すること。

なお **ホストに Node は入っていない。** フロントエンドのコマンドはコンテナ内で実行する。Docker 開発環境(Dockerfile / compose.yaml / Dev Container)は整備中で、確定後にここへ起動・開発コマンドを追記する。それまでの暫定手段は以下。

```bash
# frontend/ で lint / build を実行する例
docker run --rm -v "$PWD:/work" -w /work/frontend node:24-bookworm-slim npm run lint
docker run --rm -v "$PWD:/work" -w /work/frontend node:24-bookworm-slim npm run build
```

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
- `frontend/` — Next.js フロントエンド。**Next.js 16.3 / TypeScript / App Router / ESLint / Tailwind CSS v4 / npm。** アプリコードは `src/` 配下、import alias は `@/*` → `./src/*`。Node は 24.x(`package.json` の `engines.node` で固定)。構成の根拠は ADR-0002〜0006
- `infra/` — AWS インフラコード(未実装)
- `documents/` — 設計ドキュメント(日本語)。`ADR/`(確定した意思決定)、`00_検討/`(検討記録)、`task-memo/`、`template/`、`frontend/01_design/`、`frontend/02_spec/` のサブディレクトリあり

## 規約

- ドキュメント・コミュニケーションは日本語
- コミットメッセージは `add:` `fix:` などのプレフィックス + 日本語の要約(例: `add: 必要API`)
- ブランチ名は  `feature/<内容>` 形式
- 設計検討の記録(ディスカッション記録)は `documents/00_検討/` に `YYYYMMDD_<トピック>.md` 形式で保存する
- 確定したアーキテクチャ上の意思決定は ADR として `documents/ADR/` に `NNNN-<トピック>.md` 形式(連番)で保存する。1 ADR = 1 決定。構成は `documents/ADR/0001-フロントエンド実行環境.md` を雛形とする
