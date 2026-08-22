# ADR-0018: Node.js を 24.x とし `package.json` を GitHub Actions のバージョン入力にする

- ステータス: 決定
- 日付: 2026-08-22
- 置き換える ADR: [ADR-0002](0002-Nodeバージョン.md)（Vercel が `engines.node` を読むことを根拠にした固定方法を、GitHub Actions でビルドする現行方式に合わせて置き換える）
- 依存:
  - [ADR-0012](0012-フロントエンドデプロイ先.md)（フロントエンドのデプロイ先は Amplify Hosting）
  - [ADR-0017](0017-GitHubActionsによるAmplify直接配備とCloudFront経由のAPI公開.md)（GitHub Actions が静的成果物をビルドし、Git 非接続の Amplify App へ直接配備する）
- 被依存:
  - [ADR-0006](0006-開発用Dockerベースイメージ.md)（開発用 Docker イメージの Node.js メジャーバージョンを本 ADR に合わせる）
  - [#19](https://github.com/study-basic-hackathon/hanasu/issues/19)（GitHub Actions の Node.js バージョン設定を実装する）

## コンテキスト（背景と課題）

ADR-0002 は、Vercel が `package.json` の `engines.node` を読むことを根拠に、Node.js 24.x と固定方法を決めていた。ADR-0012 でデプロイ先を Amplify Hosting へ変更したためこの根拠は失効し、さらに ADR-0017 で、Amplify はビルドせず GitHub Actions が静的成果物をビルドして直接配備する方式になった。

Node.js 24.x の選定は維持したまま、GitHub Actions の実行環境へバージョンを反映する方法と、`engines.node`、Dockerfile、Amplify の責務を決め直す必要がある。

## 決定

- フロントエンドで使用する Node.js は **24.x** とする。
- **`frontend/package.json` の `engines.node: "24.x"` を、Node.js バージョンの宣言兼 GitHub Actions が読むバージョン指定の正とする。**
- GitHub Actions は `actions/setup-node` の `node-version-file` に `frontend/package.json` を指定し、`engines.node` の値をビルド環境へ反映する。
- 開発用 Dockerfile は `node:24-*` のメジャーバージョンを `engines.node` と一致させる。
- Amplify Hosting は GitHub Actions が生成した静的成果物を受け取るだけなので、ライブパッケージ更新と `amplify.yml` では Node.js バージョンを指定しない。
- `.nvmrc` などの専用バージョンファイルは追加しない。

## 検討した選択肢

- A案: `package.json` の `engines.node` を `actions/setup-node` の入力にする
- B案: GitHub Actions workflow の `node-version` に `24.x` を直接書く
- C案: `.nvmrc` などの専用バージョンファイルを追加し、GitHub Actions から読む
- D案: 開発用 Docker イメージを GitHub Actions のビルド環境にも使う

## 決定要因

- ADR-0017 で決まったビルド責務との整合
- Node.js バージョン値の重複と更新漏れの少なさ
- 設定がリポジトリに残り、参照元が明確であること
- ローカル Docker と GitHub Actions のメジャーバージョンを揃えられること
- #19 の workflow を単純に保てること

## 理由

- **A案を採用**: 既存の `engines.node` を宣言だけで終わらせず、GitHub Actions が実際に読む入力にすることで、workflow に同じ値を重複させずに Node.js 24.x を適用できる。
- **B案を見送り**: `package.json`、workflow、Dockerfile の3箇所に同じメジャーバージョンを持つため、更新漏れの余地が増える。
- **C案を見送り**: ホストで Node.js を使わない現行開発フローでは専用ファイルの利用者がなく、管理箇所だけが増える。
- **D案を見送り**: 開発環境との一致は最も強いが、静的成果物の取り出しとキャッシュが複雑になり、ハッカソン期間の単純さに合わない。
- **Amplify 側の指定を見送り**: Git 非接続の直接配備では Amplify がビルドしないため、Amplify のビルドイメージを設定しても GitHub Actions の Node.js バージョンには影響しない。

## 影響・トレードオフ

- 良い影響:
  - `engines.node` が Node.js 24.x の宣言と CI の実入力を兼ね、バージョン値の重複が減る
  - Amplify コンソール設定と `amplify.yml` を増やさず、Git 非接続の配備方式と整合する
  - Node.js のメジャーバージョンと開発用 Docker イメージは変更せずに済む
- 受け入れたトレードオフ・残るリスク:
  - Dockerfile のイメージタグは別の仕組みなので、`engines.node` とのメジャーバージョン一致を更新時に確認する必要がある
  - `actions/setup-node` が `package.json` の `engines.node` を読む仕様に依存するため、action のメジャー更新時に公式仕様と実行ログを確認する必要がある
  - `24.x` はパッチバージョンを固定しない。runner のキャッシュを使うか最新パッチを確認するかは #19 の workflow 実装で決める

## フォローアップ

- [#19](https://github.com/study-basic-hackathon/hanasu/issues/19) で `actions/setup-node` の `node-version-file` に `frontend/package.json` を指定し、ビルドログの `node --version` で 24.x を確認する。
- Node.js メジャーバージョンを更新するときは、`frontend/package.json` と開発用 Dockerfile のイメージタグを同時に更新する。
- `CLAUDE.md` と `frontend/Dockerfile` に残る旧デプロイ方式の説明は、#19 または別のドキュメント整合タスクで更新する。
- 再検討のトリガー: ADR-0017 を置き換えて Amplify ネイティブビルドへ移行する場合、Node.js 24 がサポート対象外になる場合、または `actions/setup-node` が `engines.node` の読み取りをサポートしなくなる場合。

## 備考

選択肢の比較、公式資料、議論ログは[検討記録: Amplify 前提の Node.js バージョン固定方法](../00_検討/20260822_Amplify前提のNodeバージョン固定方法.md)を参照。
