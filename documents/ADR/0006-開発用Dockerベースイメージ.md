# ADR-0006: 開発用 Docker ベースイメージを `node:24-bookworm-slim` とする

- ステータス: 決定
- 日付: 2026-08-06
- 依存:
  - **[ADR-0018](0018-GitHubActionsのNodeバージョン.md)(Node.js を 24.x とし `package.json` を GitHub Actions のバージョン入力にする)に依存する。** イメージタグのメジャーバージョン `24` は ADR-0018 の決定に従う。ADR-0018 が更新されれば本イメージのタグも合わせて変更する。
  - **[ADR-0012](0012-フロントエンドデプロイ先.md)(デプロイ先を Amplify Hosting とする)と [ADR-0017](0017-GitHubActionsによるAmplify直接配備とCloudFront経由のAPI公開.md)(GitHub Actions がビルドする)に依存する。** 本番ビルドは GitHub Actions、本番配信は Amplify Hosting が担うため、このイメージは**開発専用**であり、イメージサイズの最適化が判断軸にならないという前提が成り立っている。

## コンテキスト(背景と課題)

タスクメモ [0805-Frontend動作検証用初期構築](../task-memo/0805-Frontend動作検証用初期構築.md) では、フェーズ1 で開発用 Dockerfile を作成し、フェーズ2 でそれを Dev Container として再利用する計画になっている。ベースイメージの選択はフェーズ2 での開発ツール導入のしやすさに影響するため、Dockerfile 作成前に決める必要があった。

ADR-0001 のとおり本番ビルド・実行は Vercel 側で行われるため、**このイメージは開発専用**である。本番イメージのサイズ最適化やコールドスタートは論点にならない。

その後、ADR-0012 でデプロイ先を Amplify Hosting、ADR-0017 でビルドを GitHub Actions が担う方式へ変更した。開発用イメージという位置づけは変わらず、現行の Node.js バージョン依存は ADR-0018 が置き換えている。

## 決定

開発用コンテナのベースイメージを **`node:24-bookworm-slim`** とする。あわせて次を決める。

- 公開ポート: **3000**
- `node_modules`: **コンテナ側の named volume に分離**(ホスト側には作らない)

## 検討した選択肢

- A案: `node:24-bookworm-slim`(Debian slim / glibc)
- B案: `node:24-alpine`(Alpine / musl)
- C案: `node:24`(Debian フル)

## 決定要因

- Dev Container 化(フェーズ2)との相性
- 環境の素直さ(ツール導入時に libc 由来の問題を踏まないか)
- イメージサイズ(開発専用のため優先度は低い)

## 理由

- **`node:24-bookworm-slim` を採用**: VSCode Server や各種 CLI ツールは glibc 前提のビルドが多く、Dev Container 化まで進める前提では**環境の素直さがサイズより重要**。必要なツール(git 等)は Dockerfile で明示的に足せばよい。
- **`node:24-alpine` を見送り**: Turbopack は Linux musl をサポートしており動作自体に問題はないが、ネイティブモジュールの prebuilt binary が musl 向けに用意されていないことがあり、ソースビルドや musl 非対応バイナリの問題を踏む可能性がある。開発専用のためイメージサイズの利点が効かず、リスクに見合わない。
- **`node:24`(フル)を見送り**: git・build-essential 等を同梱するが、必要なものだけを Dockerfile で足せば足りるため冗長。

## 影響・トレードオフ

- 良い影響:
  - Dev Container での開発ツール導入(VSCode 拡張・git・AI ツール等)が素直に進む
  - マルチアーキテクチャ対応のため、Apple Silicon と Intel が混在しても同じ Dockerfile が使える
- 受け入れたトレードオフ・残るリスク:
  - Alpine と比べてイメージサイズが大きい(開発専用のため影響は限定的)
  - slim には git が入っていないため、Dev Container で使うツールは明示的にインストールする必要がある
  - **イメージタグと `package.json` の `engines.node` が別々の場所にあるため、片方だけ更新するとローカルと GitHub Actions の Node バージョンが食い違う**

## フォローアップ

- 開発用 Dockerfile と `compose.yaml` を作成する(タスクメモ フェーズ1)。ポート 3000 を公開し、ソースを bind mount、`node_modules` は named volume に分離する
- Dev Container で必要なツール(git 等)を Dockerfile でインストールする(フェーズ2)
- イメージタグと `engines.node` のメジャーバージョンが一致していることを、Dockerfile 作成時と Node バージョン更新時に確認する。GitHub Actions は ADR-0018 に従い `engines.node` を読む
- 再検討のトリガー: ADR-0018 で Node のメジャーバージョンが変わった場合、またはイメージのビルド時間・サイズが開発の障害になった場合

## 備考

検討の経緯・3案の比較表・Turbopack の対応プラットフォームの出典は [検討記録: フロントエンド開発用 Docker ベースイメージ](../00_検討/20260806_フロントエンド開発用Dockerベースイメージ.md) を参照。
