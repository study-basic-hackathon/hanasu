> **このメモは凍結しました（2026-08-08）。** タスク管理を GitHub Issue に移行したため、以降の進捗は [Issue #10 \[frontend\]動作確認用サンプル作成](https://github.com/study-basic-hackathon/hanasu/issues/10) で管理します。本メモはフェーズ1の実測結果・判断理由の記録として残します。方針は [検討記録: AI に実装させるためのタスク運用方針](../00_検討/20260808_AI向けタスク運用方針.md) を参照。
>
> 残作業（Dev Container 化）は Issue #10 の完了条件に移してあります。

ステータス：着手中（進捗は Issue #10 が正）
優先度：高
  
## 概要
動作確認用のサンプル作成

以下ができたら完了。
- docker上で動くNextJsのサンプルを作成する。
- その後、dev containerを構築し、開発もコンテナ上で行えるまで環境を整備する。

## 決定事項

**全項目確定(2026-08-06)。** 各決定は ADR として記録済み。

| 項目 | 決定 | ADR | 検討記録 |
|---|---|---|---|
| Node.js バージョン | **24.x**。固定の正は `package.json` の `engines.node: "24.x"` で、Dockerfile のタグを一致させる。`.nvmrc` は Vercel に効かないため根拠にしない | [ADR-0002](../ADR/0002-Nodeバージョン.md) | [記録](../00_検討/20260806_Nodeバージョンの選定と固定方法.md) |
| パッケージマネージャ | **npm**。`package-lock.json` をコミットし、Vercel の lockfile 検出に任せる | [ADR-0003](../ADR/0003-パッケージマネージャ.md) | [記録](../00_検討/20260806_パッケージマネージャの選定.md) |
| Next.js プロジェクト初期構成 | **Next.js 16.3 / TypeScript / App Router / ESLint / Tailwind / `src/` あり / alias `@/*` / AGENTS.md 生成 / React Compiler なし** | [ADR-0004](../ADR/0004-Nextjsプロジェクト初期構成.md) | [記録](../00_検討/20260806_create-next-appの生成オプション.md) |
| 開発バンドラ | **Turbopack(デフォルト)のまま**。Docker でホットリロードが効かないと実測できた場合のみ、開発コマンドを `next dev --webpack` + `WATCHPACK_POLLING=true` に切り替える | [ADR-0005](../ADR/0005-開発バンドラ.md) | [記録](../00_検討/20260806_開発バンドラとDocker上のホットリロード.md) |
| Docker ベースイメージ | **`node:24-bookworm-slim`** / ポート 3000 / `node_modules` は named volume に分離 | [ADR-0006](../ADR/0006-開発用Dockerベースイメージ.md) | [記録](../00_検討/20260806_フロントエンド開発用Dockerベースイメージ.md) |

### プロジェクト生成コマンド

```bash
npx create-next-app@latest frontend \
  --ts --app --eslint --tailwind --src-dir --import-alias "@/*" \
  --no-react-compiler --agents-md --use-npm
```

### 決定に伴う申し送り

- **Linter を ESLint としたのは「一旦」の判断。** ESLint + Prettier の管理が重いと感じたら Biome への移行を再検討する
- **Next.js 16 から `next build` は Linter を実行しない。** `npm run lint` を回す運用(手動 / CI)を別途決める
- **Turbopack の Docker 上でのホットリロードは未実測。** フェーズ1 の検証タスクで実測し、結果を ADR-0005 と検討記録に追記する
- **`frontend/CLAUDE.md` が生成される。** ルートの `CLAUDE.md` と役割が重複しないか生成後に確認する

## タスク

### フェーズ1: Docker 上で動く Next.js サンプル

- [x] 事前決定（必須）: Node バージョンを決め「決定事項」に記録する（済: 24.x — [ADR-0002](../ADR/0002-Nodeバージョン.md)。固定は `package.json` の `engines.node`）
- [x] 事前決定（必須）: パッケージマネージャ（npm / pnpm）を決め「決定事項」に記録する（済: npm — [ADR-0003](../ADR/0003-パッケージマネージャ.md)）
- [x] 事前決定（必須）: ルーター方式（App Router / Pages Router）を決め「決定事項」に記録する（済: App Router — [ADR-0004](../ADR/0004-Nextjsプロジェクト初期構成.md)）
- [x] 事前決定（任意）: create-next-app の細部オプション（Tailwind・`src/` ディレクトリ・import alias 等）（済: Tailwind 有効 / `src/` 有効 / alias `@/*` / Linter は ESLint / React Compiler なし / AGENTS.md 生成 — [ADR-0004](../ADR/0004-Nextjsプロジェクト初期構成.md)）
- [x] 事前決定（任意）: 開発バンドラと Docker ベースイメージ（済: Turbopack のまま — [ADR-0005](../ADR/0005-開発バンドラ.md) / `node:24-bookworm-slim` — [ADR-0006](../ADR/0006-開発用Dockerベースイメージ.md)）
- [x] `frontend/` に create-next-app で Next.js プロジェクトを作成する（2026-08-06 完了。Next.js 16.3.0 / React 19.2.8）
- [x] `package.json` の `engines.node` で Node バージョンを固定する（2026-08-06 完了。`"engines": { "node": "24.x" }`。Vercel が読むのは `engines` と Project Settings のみで、`.nvmrc` は公式ドキュメントに記載がない）
- [x] 動作確認（2026-08-06 完了。下記 Dockerfile / compose 作成 → 起動 → ホットリロードまで一通り確認。詳細は作業ログ）
- [x] 開発用 Dockerfile を作成する(`next dev` を実行する開発用途のもの)（2026-08-06 完了。`frontend/Dockerfile`）
- [x] `compose.yaml` を作成する(ポート 3000 公開、ソースの bind mount、`node_modules` はコンテナ側に分離)（2026-08-06 完了。`frontend/compose.yaml`。`.next` も名前付きボリュームに分離した）
- [x] `docker compose up` でサンプルページが表示されることを確認する（2026-08-06 完了。HTTP 200、`<title>Create Next App</title>` を確認）
- [x] ホットリロードが効くことを確認する（2026-08-06 完了。**Turbopack のまま問題なく効いた**ため webpack へのフォールバックは不要だった）

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
- [ADR-0003: フロントエンドのパッケージマネージャを npm とする](../ADR/0003-パッケージマネージャ.md) — ADR-0001 に依存する
- [ADR-0004: Next.js プロジェクトの初期構成を create-next-app の推奨デフォルト + `src/` とする](../ADR/0004-Nextjsプロジェクト初期構成.md) — ADR-0001 / ADR-0003 に依存する
- [ADR-0005: 開発時のバンドラを Turbopack のままとする](../ADR/0005-開発バンドラ.md) — ADR-0001 / ADR-0004 に依存する。**Docker 上のホットリロードは 2026-08-06 に実測済み（問題なく動作、webpack へのフォールバックは不要）**
- [ADR-0006: 開発用 Docker ベースイメージを `node:24-bookworm-slim` とする](../ADR/0006-開発用Dockerベースイメージ.md) — ADR-0001 / ADR-0002 に依存する
- [検討記録: フロントエンド実行環境](../00_検討/20260804_フロントエンド実行環境.md)
- 本メモ「決定事項」の根拠となる検討記録(論点ごとに分割):
  - [Node.js バージョンの選定と固定方法](../00_検討/20260806_Nodeバージョンの選定と固定方法.md)
  - [パッケージマネージャの選定](../00_検討/20260806_パッケージマネージャの選定.md)
  - [create-next-app の生成オプション](../00_検討/20260806_create-next-appの生成オプション.md)
  - [開発バンドラと Docker 上のホットリロード](../00_検討/20260806_開発バンドラとDocker上のホットリロード.md)
  - [フロントエンド開発用 Docker ベースイメージ](../00_検討/20260806_フロントエンド開発用Dockerベースイメージ.md)

---
# 作業ログ

## 2026-08-06 create-next-app 実行

**ホストに Node が入っていなかったため、生成自体を Docker コンテナ内で実行した。** 決定済みのベースイメージ（`node:24-bookworm-slim`）をそのまま使ったので、生成時の Node バージョンも 24 系で `engines.node` と一致している。

```bash
# frontend/.gitkeep を削除してから実行（create-next-app が空でないディレクトリを拒否するため）
docker run --rm -v "$PWD:/work" -w /work \
  node:24-bookworm-slim \
  npx --yes create-next-app@latest frontend \
    --ts --app --eslint --tailwind --src-dir --import-alias "@/*" \
    --no-react-compiler --agents-md --use-npm --disable-git
```

- `--disable-git` は ADR-0004 のコマンドには無いが、既に git 管理下のリポジトリであることと、slim イメージに git が入っていないことから追加した
- 生成物のファイル所有権はホストユーザーのまま（Docker Desktop の uid マッピングが効いている）

**生成結果**

- Next.js 16.3.0 / React 19.2.8 / TypeScript / App Router / ESLint / Tailwind CSS v4
- `src/app/`（`layout.tsx` / `page.tsx` / `globals.css` / `favicon.ico`）、import alias `@/*` → `./src/*`
- `package-lock.json` が生成され、`.gitignore` の対象外（＝コミットされる）。`node_modules` と `.next/` は除外済み
- `frontend/CLAUDE.md` は `@AGENTS.md` の1行のみで、ルートの `CLAUDE.md` と内容が重複しない（ADR-0004 の懸念は解消）
- `AGENTS.md` は `next dev` が自動で書き戻すブロック。ファイル自身に「作業と一緒にコミットすればツリーがきれいに保てる」と書かれているため、コミット対象とする

**追加で行った変更**

- `@types/node` を `^20` → `^24` に更新した。create-next-app のデフォルトは `^20` だったが、ADR-0002 で Node 24.x と決めているため揃えた

**検証結果**

- `npm run lint`: エラーなし
- `npm run build`: 成功（Turbopack、2.7 秒でコンパイル、`/` と `/_not-found` を静的生成）

## 2026-08-06 Docker 開発環境の構築と動作確認

**作成したファイル**

- `frontend/Dockerfile` — `node:24-bookworm-slim` ベース。`package.json` / `package-lock.json` だけ先に `COPY` して `npm ci` を走らせ、ソース変更のたびに依存を入れ直さずに済むようにした。`CMD` は `npm run dev -- -H 0.0.0.0`（`-H 0.0.0.0` がないとホストからアクセスできない）
- `frontend/compose.yaml` — ポート 3000 を公開、`.:/app` を bind mount、`node_modules` と `.next` を名前付きボリュームに分離
- `frontend/.dockerignore` — `node_modules` / `.next` / `.git`

**`.next` も名前付きボリュームに分離した理由**（タスクメモの当初指定は `node_modules` のみ）

bind mount だけだとホスト側の `.next`（`npm run build` の成果物）とコンテナ側の dev サーバーが同じディレクトリを奪い合う。書き込みも多いため、macOS の bind mount 経由にすると遅くなる。分離することで両方を避けられる。

**起動と確認**

```bash
cd frontend
docker compose up -d --build
```

- 起動ログ: `▲ Next.js 16.3.0 (Turbopack)` / `✓ Ready in 278ms`
- `curl http://localhost:3000` → **HTTP 200**、`<title>Create Next App</title>` を確認

**ホットリロードの実測（ADR-0005 の未実測項目）**

`src/app/page.tsx` の見出し文字列を書き換えて `curl` し、変更が反映されるかを2回（変更 → 復元）確認した。

- **いずれも即座に反映された。Turbopack のまま問題なく動作している。**
- したがって **`next dev --webpack` + `WATCHPACK_POLLING=true` へのフォールバックは不要**だった
- 環境: macOS（Apple Silicon）+ Docker Desktop 29.1.3。懸念していた Turbopack の Docker ファイル監視の未解決 issue（[#80665](https://github.com/vercel/next.js/issues/80665) ほか）は、この環境では再現しなかった
- 検証はサーバー応答での確認まで。**ブラウザ上の Fast Refresh（画面が自動で切り替わる挙動）は目視での確認が必要**
- 検証用の変更は元に戻し済み

