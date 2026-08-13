# ADR-0004: Next.js プロジェクトの初期構成を create-next-app の推奨デフォルト + `src/` とする

- ステータス: 決定
- 日付: 2026-08-06
- 依存:
  - **[ADR-0001](0001-フロントエンド実行環境.md)(デプロイ先を Vercel とする)に依存する。** Vercel でのビルドが前提のため、Linter がビルドをブロックしないことや SSR の要否が判断に影響している。
  - **[ADR-0003](0003-パッケージマネージャ.md)(パッケージマネージャを npm とする)に依存する。** `create-next-app` の `--use-npm` 指定は ADR-0003 の決定に従う。
- 被依存: **[ADR-0005](0005-開発バンドラ.md)** が本 ADR に依存する(Next.js 16.3 の既定バンドラが Turbopack であることが前提)。

## コンテキスト(背景と課題)

`frontend/` に `create-next-app` で Next.js プロジェクトを作成するにあたり、生成時のオプションを確定させる必要があった。TypeScript の有無・ルーター方式・`src/` ディレクトリの有無は**生成時にしか選べず、後から変えるとディレクトリ移動や設定の作り直しになる**ため、実行前に決める必要があった。

検討の過程で「そもそも Linter は必須か」という問いが出た。調査の結果、`create-next-app` には `--no-linter` があり、**Next.js 16 では `next build` が Linter を実行しないため、Linter なしでもローカルのビルドも Vercel へのデプロイも通る**ことが分かった。つまり技術的には必須ではなく、入れるか否かを判断する必要があった。

## 決定

Next.js プロジェクトの初期構成を次のとおりとする。

| 項目 | 決定 |
|---|---|
| Next.js | 16.3(`create-next-app@latest`) |
| TypeScript | 有効 |
| ルーター | App Router |
| Linter | ESLint(一旦) |
| React Compiler | 無効 |
| Tailwind CSS | 有効 |
| `src/` ディレクトリ | 有効 |
| import alias | `@/*` |
| AGENTS.md / CLAUDE.md | 生成する |

実行コマンド:

```bash
npx create-next-app@latest frontend \
  --ts --app --eslint --tailwind --src-dir --import-alias "@/*" \
  --no-react-compiler --agents-md --use-npm
```

## 検討した選択肢

- 各項目について `create-next-app` の推奨デフォルトを採用するか、外すか
- Linter: ESLint / Biome / なし(`--no-linter`)
- `src/` ディレクトリ: 有効 / 無効(デフォルト)

## 決定要因

- 既存ドキュメント(`技術スタック.md`・タスクメモ)との整合
- 生成後に変更するコスト(生成時に決めないと高くつく項目か)
- ハッカソン期間内で構築を速く終えられること

## 理由

- **大半は推奨デフォルトをそのまま採用**: TypeScript は `技術スタック.md` の記載と整合し、App Router は Next.js 16 系の機能・ドキュメントの前提。import alias `@/*` は変更する理由がない。React Compiler のみデフォルト(無効)のまま据え置き、ハッカソン期間で不確定要素を増やさない。
- **`src/` のみデフォルトから外して有効化**: `frontend/` 直下に Dockerfile・compose.yaml・`.devcontainer/` などインフラ寄りのファイルが並ぶため、アプリコードを `src/` に隔離したほうが読み分けやすい。公式ドキュメントのパス表記(`app/...`)とはズレるが、Next.js 公式も `src` フォルダ規約としてサポートしている。
- **Linter に ESLint を採用**: 技術的には必須ではないが、**導入コストが非対称**である点を重視した。生成時に入れるコストはゼロで、後から入れると設定作成に加えて既存コードの警告対応が発生する。また Next.js 16 では `next build` が lint を実行しないため、入れても開発やデプロイがブロックされない。TypeScript がある分、汎用的なバグ検出の価値は下がっているが、`@next/eslint-plugin-next` が拾う **`next/image` / `next/link` の使い忘れ**は型では検出できずパフォーマンスに直結するため、実益がある。
- **Biome を見送り**: Linter と Formatter が1つにまとまり管理対象が減る利点があるが、日本語情報量と Next.js 固有ルールを優先した。**この判断は「一旦」のものであり、ESLint + Prettier の管理が重いと感じたら移行を再検討する。**
- **Tailwind CSS を有効**: 推奨デフォルトであり、画面を素早く形にできる。後付けは設定ファイル追加とスタイル書き換えが必要になる。
- **AGENTS.md / CLAUDE.md を生成**: Next.js 16.3 は `next dev` のたびにバージョン一致したドキュメントへのポインタを維持するため、AI エディタが古い書き方をするのを防げる。

## 影響・トレードオフ

- 良い影響:
  - 生成コマンド一発で開発を始められ、フロントの構築に時間を使わずに済む
  - `src/` によりアプリコードとインフラ設定ファイルが分離され、ディレクトリの見通しがよい
  - Linter により Next.js 固有のアンチパターンを機械的に検出でき、AI が生成したコードのガードレールにもなる
- 受け入れたトレードオフ・残るリスク:
  - `src/` 有効は公式ドキュメントのパス表記とズレるため、ドキュメントを写経する際に読み替えが必要
  - ESLint + Prettier の2つを管理することになる(Biome なら1つで済んだ)
  - **`next build` が Linter を実行しないため、`npm run lint` を回す運用を別途決めないと lint 漏れに気づかない**
  - `frontend/CLAUDE.md` が生成され、リポジトリルートの `CLAUDE.md` と二重管理になる
  - `next dev` が `AGENTS.md` を自動更新するため、git 差分にノイズが出る可能性がある

## フォローアップ

- 上記コマンドで `create-next-app` を実行する(タスクメモ [0805-Frontend動作検証用初期構築](../task-memo/0805-Frontend動作検証用初期構築.md) フェーズ1)
- 生成後、`package.json` に `lint` スクリプトがあることを確認し、lint を回す運用(手動 / CI)を決める
- 生成された `frontend/CLAUDE.md` の内容を確認し、ルートの `CLAUDE.md` と役割が重複・矛盾しないよう整理する
- `next dev` による `AGENTS.md` の自動更新が差分ノイズになる場合、`.gitignore` 対象にするかを判断する
- 再検討のトリガー: ESLint + Prettier の管理が重いと感じた場合(Biome への移行)、または画面仕様の確定で SSR が必要と判明した場合(ADR-0001 の前提に影響)

## 備考

検討の経緯・Linter 3択の比較表・各オプションの出典は [検討記録: create-next-app の生成オプション](../00_検討/20260806_create-next-appの生成オプション.md) を参照。
