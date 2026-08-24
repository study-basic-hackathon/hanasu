# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

「hanasu」はハッカソン用のプロジェクトで、面接を想定した AI との音声会話を録音・文字起こしし、話し方(話速・フィラー)と内容(構成・中身)を分析して評価・アドバイスを返すサービス。**「抑揚」「声の大きさ」は評価指標に採らない**(ADR-0009)。

**`frontend/`(Next.js)`backend/`(FastAPI)`infra/`(Terraform)はいずれも実装に着手済み。** ただしこの CLAUDE.md に書いてある開発コマンドはフロントエンドのぶんだけで、**`backend/` `infra/` の開発コマンドは未記載**(動かし方を確認したうえで別途追記する)。未実装の仕様については `documents/` 配下の設計ドキュメントが唯一の情報源。

## フロントエンドの開発コマンド

**ホストに Node は入っていない。すべてコンテナ内で実行する。**

### Docker Compose で動かす

```bash
cd frontend

# 開発サーバーを起動（http://localhost:3000）。ホットリロードは Turbopack のまま動作する
docker compose up -d --build   # 初回・依存変更時
docker compose up -d           # 2回目以降
docker compose logs -f         # ログを追う
docker compose down            # 停止

# lint / build（Next.js 16 では next build が lint を実行しないため lint は個別に回す）
docker compose run --rm web npm run lint
docker compose run --rm web npm run build
```

`node_modules` と `.next` は名前付きボリュームに分離してあるため、ホスト側には作られない。依存を追加したら `docker compose up -d --build` でイメージを作り直す。

### Dev Container で開発する

`frontend/.devcontainer/devcontainer.json` を用意済み。VSCode で `frontend/` を開き「Reopen in Container」を実行すると、上記 `compose.yaml` の `web` サービスにそのまま入る(専用の Docker 定義は持たない)。

- コンテナ内のワークスペースは `/app`。入った時点で `npm run dev` が動いており <http://localhost:3000> が開ける
- 逆に dev サーバーが落ちるとコンテナごと停止する(`overrideCommand: false` のため)
- ESLint / Tailwind CSS IntelliSense 拡張と、プロジェクトの TypeScript を使う設定はコンテナ側に入る
- **マウントしているのは `frontend/` だけで `.git` は含まれない。git 操作はホスト側で行う**

## 技術スタック

正本は `documents/技術スタック.md`。以下はその要約:

- **バックエンド**: Python / FastAPI(`backend/` に配置、デプロイ先は AWS ECS(Fargate))
- **フロントエンド**: TypeScript / Next.js(`frontend/` に配置、デプロイ先は **AWS Amplify Hosting**。ADR-0012 で Vercel から変更。GitHub Actions が静的成果物をビルドし、Git 非接続 App へ手動実行で直接配備する — ADR-0019)
- **インフラ**: AWS(`infra/` に配置)— VPC、ALB、ECR、ECS、RDS(**応募情報・評価結果**。ADR-0009)、CloudWatch Logs、Bedrock(会話の質問生成と評価の定性項目。ADR-0010)、S3(Terraform の state 管理用)、Amplify Hosting(フロントエンド)。IaC は Terraform、CI/CD は GitHub Actions
- **音声認識**: **AmiVoice**(ADR-0010)。`keepFillerToken=1` を付けてフィラーを保持したまま文字起こしする**商用の外部 API**
- 使わない想定:
  - Cognito — 認証は簡易的。**会員登録は実装せず、固定の ID / パスワード1組を使う**(ADR-0011)
  - S3(音声データ)— **音声はブラウザの IndexedDB に一時保持し、サーバーは処理後に破棄する**(ADR-0007)。会話履歴・音声・文字起こしは DB にも保存しない
  - Chime SDK — **1対1かつ相手が AI のため、代替不能な機能がない。** 音声はブラウザの `MediaRecorder` で取得しターンごとに HTTP で送る(ADR-0007)
  - NAT Gateway — コスト削減のため ECS タスクは Public サブネットに直接配置する

## API

API の一覧と入出力仕様は `documents/backend/API仕様.md` が正本(会話・評価まわりの構成は ADR-0008 で確定済み)。

## リポジトリ構成

- `backend/` — Python / FastAPI バックエンド。アプリコードは `app/` 配下(`routers/` `models/` `schemas/`)。**認証 API(`POST /token` / `GET /users/me`)まで実装済み。** DB は PostgreSQL(SQLAlchemy + psycopg)、Python は 3.14、依存は `pyproject.toml` / `uv.lock`(uv)で管理。リポジトリ直下の `docker-compose.yml` が API と DB をまとめて起動する
- `frontend/` — Next.js フロントエンド。**Next.js 16.3 / TypeScript / App Router / ESLint / Tailwind CSS v4 / npm。** アプリコードは `src/` 配下、import alias は `@/*` → `./src/*`。Node は 24.x(`package.json` の `engines.node` を GitHub Actions が読み、Dockerfile のメジャーバージョンも揃える — ADR-0018)。本番ビルドは `output: "export"` で `out/` を生成し、`.github/workflows/deploy-frontend-to-amplify.yml` が Amplify Hosting へ手動実行で直接配備する。**UI は Tailwind CSS のみで実装する(コンポーネント集を足さない)。デザイントークンは `globals.css` の `@theme` に持つ — ADR-0014。** 構成の根拠は ADR-0003〜0006、ADR-0012、ADR-0018、ADR-0019
- `infra/` — AWS インフラコード(Terraform)。`bootstrap/`(state 用 S3 バケット)と `dev/`(VPC / ALB / ECR / ECS Fargate)。**RDS・Bedrock はまだ定義していない。** 構築から破棄までの手順は `infra/dev/README.md`
- `documents/` — 設計ドキュメント(日本語)。`ADR/`(確定した意思決定)、`00_検討/`(検討記録)、`task-memo/`、`template/`、`backend/`、`frontend/01_design/` のサブディレクトリあり。**書き方のルールは `documents/README.md`**

## 規約

- ドキュメント・コミュニケーションは日本語
- コミットメッセージは `add:` `fix:` などのプレフィックス + 日本語の要約(例: `add: 必要API`)
- ブランチ名は  `feature/<内容>` 形式
- **ドキュメントを追加・更新するときは `documents/README.md` に従う**(正本の所在・仕様書に書かないことの基準・配置と命名。ADR-0013)
