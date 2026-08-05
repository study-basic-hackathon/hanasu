ステータス：着手中
優先度：高
  
## 概要
動作確認用のサンプル作成

以下ができたら完了。
- docker上で動くNextJsのサンプルを作成する。
- その後、dev containerを構築し、開発もコンテナ上で行えるまで環境を整備する。

## 決定事項

論点ごとに検討記録を作成済み。承認された項目から順に確定していく。

### 確定

**Node.js バージョンと固定方法(2026-08-06 決定)** — [ADR-0002](../ADR/0002-Nodeバージョン.md) / 根拠: [検討記録](../00_検討/20260806_Nodeバージョンの選定と固定方法.md)

- Node.js は **24.x** を使う(Vercel が使える3系のうち唯一の Active LTS。Vercel のデフォルトとも一致)
- 固定の「正」は **`package.json` の `engines.node: "24.x"`**。Dockerfile のイメージタグをこれに一致させる
- `.nvmrc` は置いてもよいが、**Vercel には効かない**ため整合の根拠にはしない(Vercel が読むのは `engines.node` と Project Settings のみ)

### 承認待ち

| 論点 | 推奨案 | 検討記録 |
|---|---|---|
| パッケージマネージャ | npm | [記録](../00_検討/20260806_パッケージマネージャの選定.md) |
| create-next-app の生成オプション | Next.js 16.3 / TypeScript / App Router / ESLint / Tailwind / `src/` あり / alias `@/*` / AGENTS.md 生成 / React Compiler なし | [記録](../00_検討/20260806_create-next-appの生成オプション.md) |
| 開発バンドラとホットリロード | Turbopack(デフォルト)で開始し、効かなければ開発時のみ `--webpack` | [記録](../00_検討/20260806_開発バンドラとDocker上のホットリロード.md) |
| Docker ベースイメージ | `node:24-bookworm-slim` / ポート 3000 | [記録](../00_検討/20260806_フロントエンド開発用Dockerベースイメージ.md) |

チーム確認が必要な項目: Tailwind CSS の要否、Linter(ESLint / Biome)、`src/` ディレクトリの要否。

## タスク

### フェーズ1: Docker 上で動く Next.js サンプル

- [x] 事前決定（必須）: Node バージョンを決め「決定事項」に記録する（済: 24.x — [ADR-0002](../ADR/0002-Nodeバージョン.md)。固定は `package.json` の `engines.node`）
- [ ] 事前決定（必須）: パッケージマネージャ（npm / pnpm）を決め「決定事項」に記録する（lockfile と Dockerfile 内コマンドに直結し、後からの変更はやり直しが大きい）
- [ ] 事前決定（必須）: ルーター方式（App Router / Pages Router）を決め「決定事項」に記録する（プロジェクト構造に直結。推奨: App Router）
- [ ] 事前決定（任意）: create-next-app の細部オプション（Tailwind・`src/` ディレクトリ・import alias 等）— 推奨デフォルトのまま進めてよく、後から変更可能（TypeScript・ESLint は技術スタックで確定済み扱い）
- [ ] `frontend/` に create-next-app で Next.js プロジェクトを作成する
- [ ] `package.json` の `engines.node` で Node バージョンを固定する(ADR-0001 フォローアップ。Vercel が読むのは `engines` と Project Settings のみで、`.nvmrc` は公式ドキュメントに記載がない)
- [ ] 開発用 Dockerfile を作成する(`next dev` を実行する開発用途のもの)
- [ ] `compose.yaml` を作成する(ポート 3000 公開、ソースの bind mount、`node_modules` はコンテナ側に分離)
- [ ] `docker compose up` でサンプルページが表示されることを確認する
- [ ] ホットリロードが効くことを確認する(Next.js 16 は Turbopack がデフォルトで、Docker 内のファイル監視に未解決 issue あり。`WATCHPACK_POLLING=true` は webpack 用のため、効かない場合は開発時のみ `next dev --webpack` + `WATCHPACK_POLLING=true` にフォールバックする)

### フェーズ2: Dev Container 化

- [ ] `.devcontainer/devcontainer.json` を作成する(フェーズ1の compose / サービスを再利用する構成)
- [ ] コンテナ内の開発ツールを整備する(VSCode 拡張: ESLint・Prettier 等、git が使えること)
- [ ] VSCode「Reopen in Container」でコンテナに入り、編集 → ホットリロード反映までの開発フローを確認する
- [ ] (任意)コンテナ内に Claude Code 等の AI ツールを導入し、履歴・認証をホストと連動させる

### 仕上げ

- [ ] 起動・開発コマンドを CLAUDE.md / README に追記する
- [ ] 本メモの「決定事項」「作業ログ」を更新し、ステータスを完了にする

## 参考

- [ADR-0001: フロントエンドのデプロイ先を Vercel とする](../ADR/0001-フロントエンド実行環境.md) — ローカル開発は Docker 上で `next dev`、Node バージョンを Vercel と統一する方針
- [ADR-0002: Node.js のバージョンを 24.x とし `package.json` の `engines` で固定する](../ADR/0002-Nodeバージョン.md) — ADR-0001 のフォローアップを具体化。ADR-0001 に依存する
- [検討記録: フロントエンド実行環境](../00_検討/20260804_フロントエンド実行環境.md)
- 本メモ「決定事項」の根拠となる検討記録(論点ごとに分割):
  - [Node.js バージョンの選定と固定方法](../00_検討/20260806_Nodeバージョンの選定と固定方法.md)
  - [パッケージマネージャの選定](../00_検討/20260806_パッケージマネージャの選定.md)
  - [create-next-app の生成オプション](../00_検討/20260806_create-next-appの生成オプション.md)
  - [開発バンドラと Docker 上のホットリロード](../00_検討/20260806_開発バンドラとDocker上のホットリロード.md)
  - [フロントエンド開発用 Docker ベースイメージ](../00_検討/20260806_フロントエンド開発用Dockerベースイメージ.md)

---
# 作業ログ

