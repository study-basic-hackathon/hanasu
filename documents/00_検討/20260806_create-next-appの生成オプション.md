# 検討: create-next-app の生成オプション

- ステータス: 検討中
- 開始日: 2026-08-06
- 最終更新: 2026-08-06
- 関連: [ADR-0001](../ADR/0001-フロントエンド実行環境.md)、[タスクメモ: 0805-Frontend動作検証用初期構築](../task-memo/0805-Frontend動作検証用初期構築.md)、[検討: パッケージマネージャの選定](20260806_パッケージマネージャの選定.md)(`--use-*` 指定に影響)、[検討: 開発バンドラと Docker 上のホットリロード](20260806_開発バンドラとDocker上のホットリロード.md)(Turbopack の扱い)

## 背景・きっかけ

`frontend/` に `create-next-app` で Next.js プロジェクトを作成するにあたり、生成時のオプションを決める必要がある。生成後に変更しづらい項目(ディレクトリ構成・Linter)が含まれるため、実行前に決めておく。

## 論点

1. **Next.js のバージョンをどうするか**
2. **各生成オプションをどうするか**(TypeScript / App Router / Linter / React Compiler / Tailwind CSS / `src/` ディレクトリ / import alias / AGENTS.md)

## 事実確認(出典付き)

**Next.js のバージョン:**

- 最新安定版は **16.3**(2026-08-03 リリース)(出典: [Next.js 16.3 リリースブログ](https://nextjs.org/blog/next-16-3))

**create-next-app の仕様(v16.3.0 時点):**

- 推奨デフォルトは **TypeScript / ESLint / Tailwind CSS / App Router / AGENTS.md**、import alias は `@/*`、バンドラは Turbopack(出典: [Next.js Docs: Installation](https://nextjs.org/docs/app/getting-started/installation)、ページ更新日 2026-07-21)
- 対話プロンプトで聞かれる項目: TypeScript の有無 / Linter(**ESLint・Biome・None** の3択)/ React Compiler の有無 / Tailwind CSS の有無 / `src/` ディレクトリの有無 / App Router の有無 / import alias / AGENTS.md の有無(出典: [Next.js Docs: create-next-app](https://nextjs.org/docs/app/api-reference/cli/create-next-app)、v16.3.0)
- 主なフラグ: `--ts`(既定)/ `--app` / `--eslint` / `--biome` / `--no-linter` / `--tailwind`(既定)/ `--react-compiler` / `--src-dir` / `--import-alias <alias>` / `--agents-md`(既定)/ `--turbopack`(既定)/ `--webpack` / `--use-npm` / `--use-pnpm` / `--empty` / `--yes`(出典: 同上)
- Linter の選択肢について、**ESLint** は `@next/eslint-plugin-next` による Next.js 固有ルールを含む。**Biome** は Linter と Formatter を兼ね(ESLint + Prettier 相当)、Next.js / React 向けの組み込みサポートがある(出典: 同上)
- `--agents-md` は `AGENTS.md` と、それを参照する `CLAUDE.md` を生成する(出典: [Next.js Docs: Installation](https://nextjs.org/docs/app/getting-started/installation))

**関連する Next.js 16 系の挙動変更:**

- **Next.js 16 から `next build` は Linter を自動実行しない。** `package.json` の scripts 経由で別途実行する必要がある(出典: [Next.js Docs: Installation](https://nextjs.org/docs/app/getting-started/installation))
- **Next.js 16.3 では `next dev` 実行時に、バージョン一致した `AGENTS.md` ブロックが自動で書き込み・維持される。** ローカル `node_modules` 内の同梱ドキュメントを指すため、AI エージェントが古い知識で書くのを防げる(出典: [Next.js 16.3 リリースブログ](https://nextjs.org/blog/next-16-3))

**リポジトリの現状:**

- `frontend/` は空(`.gitkeep` のみ)(出典: `ls frontend/` の結果)
- リポジトリルートに `CLAUDE.md` が存在する(出典: `CLAUDE.md`)
- `技術スタック.md` に「フロントエンド: TypeScript / Next.js」と記載(出典: `documents/技術スタック.md`)
- タスクメモ フェーズ2 に「VSCode 拡張: ESLint・Prettier 等」と記載(出典: `documents/task-memo/0805-Frontend動作検証用初期構築.md`)

## 選択肢の比較

比較軸: **既存ドキュメントとの整合**、**構築の速さ**(ハッカソン期間内)、**後から変更する際のコスト**。

| 項目 | 推奨 | 理由 | 後から変更するコスト |
|---|---|---|---|
| Next.js バージョン | **16.3**(`create-next-app@latest`) | 最新安定版。メモリ削減・ビルド高速化・AI エージェント向けドキュメントの恩恵を受けられる | 低(バージョンアップは随時可能) |
| TypeScript | **有効** | `技術スタック.md` の記載と整合。create-next-app のデフォルトでもある | 高(全ファイルの拡張子変更) |
| ルーター | **App Router** | 公式推奨。Next.js 16 系の新機能・ドキュメントはすべて App Router 前提 | 高(ディレクトリ構成の作り直し) |
| Linter | **ESLint** | タスクメモ フェーズ2 の「VSCode 拡張: ESLint・Prettier」と整合。`@next/eslint-plugin-next` の Next.js 固有ルールを使える。日本語情報も多い | 中(設定ファイルの入れ替え。Biome への移行は後からでも可能) |
| React Compiler | **無効** | デフォルトが無効。ハッカソン期間で不確定要素を増やさない | 低(`reactCompiler: true` で後から有効化できる) |
| Tailwind CSS | **有効** | create-next-app のデフォルト。画面を素早く形にできる | 中(後付けは設定ファイル追加とスタイル書き換えが必要) |
| `src/` ディレクトリ | **有効**(要相談) | `frontend/` 直下に Dockerfile・compose.yaml・`.devcontainer/` などインフラ寄りのファイルが並ぶため、アプリコードを `src/` に隔離すると読み分けやすい | 中(ディレクトリ移動 + tsconfig の paths 調整) |
| import alias | **`@/*`**(デフォルト) | 変更する理由がない。公式ドキュメントの記述とも一致 | 低 |
| AGENTS.md / CLAUDE.md | **生成する** | Next.js 16.3 は `next dev` のたびにバージョン一致したドキュメントへのポインタを維持する。AI エディタが古い書き方をするのを防げる | 低(不要なら削除するだけ) |
| バンドラ | **Turbopack**(デフォルト)で開始 | 別途検討([開発バンドラと Docker 上のホットリロード](20260806_開発バンドラとDocker上のホットリロード.md))を参照 | 低(開発コマンドのフラグ切り替えのみ) |

`src/` について補足すると、create-next-app のデフォルトは**無効**であり、公式ドキュメントのパス表記(`app/layout.tsx` 等)は `src/` なしを前提としている。`src/` を有効にすると `src/app/layout.tsx` となりドキュメントとズレるが、Next.js 公式も [`src` フォルダの規約](https://nextjs.org/docs/app/api-reference/file-conventions/src-folder)としてサポートしている。今回は Docker / Dev Container 関連ファイルが `frontend/` 直下に増えることを重く見て有効を推奨するが、チームの好みで決めてよい項目。

### 推奨どおりの場合の実行コマンド

```bash
npx create-next-app@latest frontend \
  --ts --app --eslint --tailwind --src-dir --import-alias "@/*" \
  --no-react-compiler --agents-md --use-npm
```

## 懸念

| 懸念 | 深刻度の感触 | 解消に必要な確認 |
|---|---|---|
| create-next-app が `frontend/CLAUDE.md` を生成し、リポジトリルートの `CLAUDE.md` と二重管理になる | 低 | 生成後に内容を確認し、ルート側(プロジェクト全体の規約)と frontend 側(Next.js の書き方)で役割を分ける。矛盾する記述があればどちらかを削る |
| `next dev` が `AGENTS.md` を自動更新するため、git 差分にノイズが出る | 低 | 初回に一度コミットし、以後の自動更新差分は都度確認する。煩わしければ `.gitignore` 対象にするかを再検討する |
| Next.js 16 から `next build` が Linter を自動実行しないため、lint 漏れに気づかない | 低 | `package.json` に `lint` スクリプトを用意し、CI か手動で回す運用を決める。Vercel のビルドでも lint は走らない点に注意 |
| Tailwind CSS を有効にしたまま使わないと、不要な依存と設定が残る | 低 | フロントエンド仕様書のデザイン方針が固まった段階で見直す |

## お客様・関係者と詰めるべき事項

| 確認相手 | 確認内容 | 回答が決定にどう効くか |
|---|---|---|
| チーム | Tailwind CSS を使うか(CSS Modules など他の手段を使う予定はあるか) | 使わないなら `--no-tailwind`。後から入れるより初期に決めたほうが安い |
| チーム | Linter を ESLint とするか Biome とするか。Prettier を併用するか | Biome なら Linter と Formatter が1つに統合され、タスクメモ フェーズ2 の VSCode 拡張構成(ESLint・Prettier)も変わる |
| チーム | `src/` ディレクトリを使うか | ディレクトリ構成が変わるため、フロントエンド仕様書や以後の実装の参照パスに影響する |

## 議論ログ

- **2026-08-06 ラウンド1**: Next.js 16.3 の公式ドキュメント(create-next-app / Installation / リリースブログ)を一次情報として調査。推奨デフォルトをベースに、既存ドキュメント(`技術スタック.md`・タスクメモ)との整合と後から変更するコストで各項目を評価。あわせて、Next.js 16 で `next build` が Linter を自動実行しなくなった点、16.3 で `next dev` が `AGENTS.md` を自動更新する点を懸念として抽出した。Tailwind / Linter / `src/` の3点は好みが分かれるためチーム確認事項とした。ユーザーの最終決定待ち。

## 結論

未確定(ステータス: 検討中)。

**推奨案**:

| 項目 | 推奨 |
|---|---|
| Next.js | 16.3(`create-next-app@latest`) |
| TypeScript | 有効 |
| ルーター | App Router |
| Linter | ESLint |
| React Compiler | 無効 |
| Tailwind CSS | 有効 |
| `src/` ディレクトリ | 有効 |
| import alias | `@/*` |
| AGENTS.md / CLAUDE.md | 生成する |

**残論点**: Tailwind CSS・Linter・`src/` の3点は「詰めるべき事項」のとおりチームの好みで決まるため、推奨をそのまま採用してよいかの確認が必要。

**次アクション**: チームで承認 → タスクメモ「決定事項」へ転記 → 本記録のステータスを「結論」に更新 → `create-next-app` を実行する。
