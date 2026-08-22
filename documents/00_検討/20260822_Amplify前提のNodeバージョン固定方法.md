# 検討: Amplify 前提の Node.js バージョン固定方法

- ステータス: 完了
- **昇格先**: [ADR-0018 Node.js を 24.x とし `package.json` を GitHub Actions のバージョン入力にする](../ADR/0018-GitHubActionsのNodeバージョン.md) — 決定内容はこちらが正本
- **仕様の正本**: [技術スタック](../技術スタック.md) — 現行仕様はこちらを見る。本記録は決定に至る経緯であり、現行仕様ではない
- 区分: **必須**（後続の #19 が GitHub Actions でビルドするときの Node.js バージョン指定と、ADR-0002 の扱いを決めないと後続作業を開始できない）
- 開始日: 2026-08-22
- 最終更新: 2026-08-22
- 関連: [Issue #42](https://github.com/study-basic-hackathon/hanasu/issues/42)、[ADR-0002](../ADR/0002-Nodeバージョン.md)、[ADR-0006](../ADR/0006-開発用Dockerベースイメージ.md)、[ADR-0012](../ADR/0012-フロントエンドデプロイ先.md)、[ADR-0017](../ADR/0017-GitHubActionsによるAmplify直接配備とCloudFront経由のAPI公開.md)、[ADR-0018](../ADR/0018-GitHubActionsのNodeバージョン.md)、[前回の検討記録](20260806_Nodeバージョンの選定と固定方法.md)、[Amplify Hosting の配備方式に関する検討記録](20260822_AmplifyHostingのIaC管理範囲とデプロイ方式.md)

## 背景・きっかけ

Issue #42 は、デプロイ先を Vercel から Amplify Hosting へ変更したことで、ADR-0002 の「`package.json` の `engines.node` を Node.js バージョン固定の正とする」という決定の根拠が失効したとして、Amplify 前提の固定方法を再決定するために起票された。Node.js のメジャーバージョンを **24.x** とする決定は本検討の対象外である。

起票時点の ADR-0012 は Amplify のビルド環境でビルドすることを前提とし、Amplify コンソールのライブパッケージ更新と `amplify.yml` の `nvm use` を候補にしていた。その後 ADR-0017 で、Amplify App は Git リポジトリに接続せず、GitHub Actions が生成した静的成果物を Amplify へ直接配備する方式に変わった。したがって、現在固定すべき対象は Amplify のビルド環境ではなく **GitHub Actions のビルド環境**である。

2026-08-06 の[前回の検討記録](20260806_Nodeバージョンの選定と固定方法.md)は Vercel 前提の議論として完了しているため再開せず、配備方式変更後の差分を本記録で新たに扱う。

## 論点

### 必須

1. GitHub Actions のビルドで Node.js 24.x をどの設定から読み、実際の実行環境へ反映するか
   - **回答（2026-08-22）**: `actions/setup-node` の `node-version-file` に `frontend/package.json` を指定する。
2. `frontend/package.json` の `engines.node` を残すか。残す場合、宣言だけにするか、CI が読むバージョン指定の正にするか
   - **回答（2026-08-22）**: 残し、Node.js 24.x の宣言兼 GitHub Actions が読むバージョン指定の正とする。
3. ADR-0002 を新しい ADR で置き換えるか、本文を直接改訂するか
   - **回答（2026-08-22）**: ADR-0018 を作成し、ADR-0002 を置き換える。旧 ADR の本文は変えず、ステータスだけを更新する。
4. ADR-0002 に依存する ADR-0006 と、起票後に配備方式が変わった ADR-0012 / ADR-0017 の関係をどう表すか
   - **回答（2026-08-22）**: ADR-0006 の依存先を ADR-0018 へ付け替え、ADR-0012 / ADR-0017 には後続決定への参照を追加する。

### 任意

1. GitHub Actions のログへ `node --version` を明示的に出し、24.x が選ばれたことを実測するか
2. Node.js 24.x の範囲で、runner のツールキャッシュにある版を使うか、`check-latest` で最新の利用可能版を毎回確認するか

## 事実確認（出典付き）

### リポジトリと Issue の現状

- Issue #42 は Node.js のメジャーバージョンを 24.x のまま維持し、固定方法と ADR-0002 の扱いだけを決める検討 Issue である。実装は #19 の範囲として明示的に除外されている（出典: [Issue #42](https://github.com/study-basic-hackathon/hanasu/issues/42)）。
- ADR-0017 は、GitHub Actions が Next.js の静的成果物 `out/` をビルドし、Git 非接続の Amplify App へ `CreateDeployment` / ZIP upload / `StartDeployment` で直接配備すると決定している。Amplify の GitHub 接続と `amplify.yml` は使用しない（出典: [ADR-0017](../ADR/0017-GitHubActionsによるAmplify直接配備とCloudFront経由のAPI公開.md)）。
- #19 の現行本文も、GitHub Actions が静的成果物をビルドすること、`amplify.yml` を追加しないこと、Node.js バージョンの決定を #42 に依存することを明記している（出典: [Issue #19](https://github.com/study-basic-hackathon/hanasu/issues/19)）。
- 現在の `frontend/package.json` は `engines.node: "24.x"`、`frontend/Dockerfile` は `FROM node:24-bookworm-slim` であり、ローカル開発のメジャーバージョンは一致している（出典: [`frontend/package.json`](../../frontend/package.json)、[`frontend/Dockerfile`](../../frontend/Dockerfile)）。
- ADR-0006 のイメージ選定は Node.js 24.x に依存するため、メジャーバージョンを維持する限りイメージタグの変更は不要である。一方、本文には Vercel および `engines.node` と Dockerfile の2箇所だけを揃える運用が残っている（出典: [ADR-0006](../ADR/0006-開発用Dockerベースイメージ.md)）。

### Amplify Hosting

- AWS 公式ドキュメントでは、Git リポジトリに接続しない配備は、事前に作成した build output の ZIP を Amplify Hosting へ渡す方式として説明されている。ZIP は build output ディレクトリそのものではなく、その中身を含める（出典: [Deploying an application to Amplify without a Git repository](https://docs.aws.amazon.com/amplify/latest/userguide/manual-deploys.html)）。
- Amplify のライブパッケージ更新と `amplify.yml` の `preBuild` における `nvm use` は、**Amplify のビルドイメージでビルドするとき**の Node.js バージョン指定方法である。`preBuild` の指定はライブパッケージ更新より後に実行され、前者を上書きする（出典: [Troubleshooting general Amplify issues: I need to update my application's Node.js version](https://docs.aws.amazon.com/amplify/latest/userguide/troubleshooting-general.html)）。
- 以上から、ADR-0017 の直接配備方式では Amplify 側の Node.js バージョン指定はビルドに関与しない。これは、AWS 公式資料と ADR-0017 を組み合わせた推論である。将来 Amplify ネイティブビルドへ戻す場合に限り、ライブパッケージ更新または `amplify.yml` を再検討する必要がある。

### GitHub Actions と `engines.node`

- `actions/setup-node` は `node-version` でバージョンを直接指定できるほか、`node-version-file` に `package.json` を指定できる。`package.json` の場合は `volta.node`、`devEngines.runtime`、`engines.node` の順で Node.js バージョンを探す（出典: [actions/setup-node: Node version file](https://github.com/actions/setup-node/blob/main/docs/advanced-usage.md#node-version-file)）。
- `actions/setup-node` は、バージョン指定を省略して runner の `PATH` にある Node.js に依存せず、常にバージョンを指定することを推奨している。`24` や `24.x` のようなメジャーバージョン指定をサポートする（出典: [actions/setup-node README](https://github.com/actions/setup-node#usage)）。
- npm における `engines.node` は、`engine-strict` を有効にしない限り宣言・警告にとどまり、単独では実行する Node.js を切り替えない（出典: [npm Docs: package.json / engines](https://docs.npmjs.com/files/package.json/#engines)）。一方、GitHub Actions が `actions/setup-node` の `node-version-file` でこの値を読む構成にすれば、CI の実行バージョンを選ぶ入力として機能する。
- Node.js 24 は本検討時点で LTS である（出典: [Node.js Releases](https://nodejs.org/en/about/previous-releases)）。ただし、メジャーバージョンの再選定は Issue #42 の対象外である。

## 選択肢の比較

### 論点1・2: GitHub Actions の固定方法と `engines.node` の位置づけ

| 観点 | A案: `package.json` を CI の入力にする | B案: workflow に `24.x` を直接書く | C案: 専用バージョンファイルを追加する | D案: Docker イメージで CI ビルドする |
|---|---|---|---|---|
| GitHub Actions の指定 | `node-version-file: frontend/package.json` | `node-version: '24.x'` | `node-version-file: frontend/.nvmrc` など | `frontend/Dockerfile` から作ったコンテナで `npm run build` |
| `engines.node` の位置づけ | **Node 24.x の宣言兼、CI が読むバージョン指定の正** | npm 互換性の宣言のみ | npm 互換性の宣言のみ | npm 互換性の宣言と Docker タグとの整合確認用 |
| Amplify 側の設定 | 不要 | 不要 | 不要 | 不要 |
| バージョン値を持つ場所 | `package.json` と Dockerfile の2箇所 | `package.json`、workflow、Dockerfile の3箇所 | `package.json`、専用ファイル、Dockerfile の3箇所 | `package.json` と Dockerfile の2箇所 |
| ローカルとの整合 | Docker タグとの同期が必要 | 3箇所の同期が必要 | 3箇所の同期が必要 | **同じ Docker イメージを使うため最も強い** |
| コード上の分かりやすさ | workflow から1段参照するが、バージョン値の重複が少ない | workflow 単体で分かりやすい | Node.js ツールでは一般的だが、本リポジトリはホストで Node.js を使わない | 実行環境は明確だが、成果物の取り出しとキャッシュが複雑になる |
| 主なリスク | `setup-node` が `package.json` を読む仕様への依存 | 片方だけ更新するドリフト | 現在の利用者がないファイルを増やす | #19 の workflow が複雑化し、ビルド時間も増えやすい |

**A案を採用した。** 既存の `engines.node: "24.x"` を残すだけでなく、GitHub Actions がその値を実際に読む構成に変えることで、「宣言」と「CI の実行バージョン」を同じ値から導ける。Dockerfile のベースイメージタグは仕組み上別に残るが、B案・C案より同期対象が1箇所少ない。Amplify 側には Node.js の設定を追加しない。

D案は開発コンテナと CI の一致を最も強くできるが、Issue #19 の静的成果物配備 workflow に Docker の build・run・成果物取り出しが加わる。ハッカソン期間の単純さを重視する現行方針では過剰になりやすい。

### 論点3: ADR-0002 の扱い

| 観点 | A案: 新しい ADR で ADR-0002 を置き換える | B案: ADR-0002 を直接改訂する | C案: ADR-0002 を残し、CI 固定だけ別 ADR にする |
|---|---|---|---|
| 履歴 | Vercel 前提の旧判断と、GitHub Actions 前提の新判断を分離できる | 旧判断のコンテキストと日付に新判断を上書きする | 旧判断は残るが、失効した Vercel 依存も「決定」のまま残る |
| 「1 ADR = 1 決定」との整合 | **良い**。新 ADR が Node 24.x と固定方法を一体で引き継ぐ | 弱い。異なる日付・前提の決定が1つの ADR に混在する | 一見分離できるが、どちらが固定方法の正か分かりにくい |
| ADR-0006 からの参照 | 新 ADR へ付け替える | 参照先は変わらない | ADR-0002 と新 ADR の両方を参照する必要がある |
| 変更量 | 中 | 小 | 中 |

**A案を採用した。** 新しい ADR で、Node.js 24.x の維持、GitHub Actions における固定方法、`engines.node` と Dockerfile の役割をまとめて決定し、ADR-0002 を置き換える。ADR-0006 の Node.js バージョン依存は新 ADR へ付け替える。2026-08-22 に main の最新番号が ADR-0017 であることを確認し、新 ADR を ADR-0018 とした。

## 影響

### A案（両論点の推奨案）を選んだ場合

- `frontend/package.json` の `engines.node: "24.x"` と `frontend/Dockerfile` の `node:24-*` は変更しない。
- #19 で `actions/setup-node` の `node-version-file` に `frontend/package.json` を指定する。これは後続実装であり、本検討では workflow を変更しない。
- Amplify のライブパッケージ更新と `amplify.yml` は使用しない。将来 ADR-0017 を覆して Amplify ネイティブビルドへ戻す場合は、固定方法を再検討する。
- ADR-0002 は新 ADR へのリンクを持つ廃止状態にし、ADR-0006 の依存先と「Vercel」「2箇所を揃える」という記述を新しい責務分担に合わせる。
- ADR-0012 の「Amplify 側で Node 24.x を明示指定する」というフォローアップは、ADR-0017 以後の方式では適用されない。新 ADR から、ADR-0012 の当該部分が後続決定で置き換わったことを明示する。
- `CLAUDE.md` の「Amplify 側の指定は構築時に決める」と `frontend/Dockerfile` の「本番は Vercel」というコメントは現行配備方式と一致していない。ただし Issue #42 の「触る範囲」は `documents/ADR/` と `documents/00_検討/` のため、本 Issue では変更せず、後続の #19 または別のドキュメント整合タスクへ申し送る。

### 検証方針

- #19 の初回 workflow で `actions/setup-node` の解決結果と `node --version` をログに出し、24.x が使われたことを確認する。
- Node.js メジャーバージョン更新時は、少なくとも `frontend/package.json` と `frontend/Dockerfile` のメジャーバージョンが一致することを確認する。
- `check-latest` の有無は24.xという方針を変えない実装詳細である。runner のツールキャッシュを優先してダウンロードを減らすなら既定値を使い、最新パッチ追随を優先するなら `check-latest: true` とする。どちらもパッチバージョンの再現性を保証しないため、完全固定が必要になった場合は別途パッチ指定を検討する。#19 で workflow の実測とあわせて決められる。

## 懸念

| 懸念 | 深刻度の感触 | 解消に必要な確認 |
|---|---|---|
| Issue #42 起票時の2案をそのまま比較すると、現在は使わない Amplify ビルド環境の設定を決めてしまう | 高 | ADR-0017 を現行前提とし、固定対象を GitHub Actions に読み替える |
| `engines.node` を残すだけでは CI の Node.js は切り替わらない | 高 | A案なら `actions/setup-node` の `node-version-file` で明示的に読む |
| `engines.node` と Dockerfile は別の仕組みのため自動では同期しない | 中 | 更新時の確認対象を新 ADR に明記し、必要なら後続 Issue で自動検証を追加する |
| ADR-0002 だけを更新すると、ADR-0006 や ADR-0012 の依存・説明が古いまま残る | 中 | 新 ADR、ADR-0002、ADR-0006 の相互リンクと、ADR-0012 / ADR-0017 との前後関係を確認する |
| `actions/setup-node` のメジャーバージョン更新で `package.json` 読み取り仕様が変わる | 低 | action 更新時に公式 README と workflow ログを確認する |

## お客様・関係者と詰めるべき事項

| 確認相手 | 確認内容 | 回答が決定にどう効くか |
|---|---|---|
| ユーザー | 固定方法を A〜D のどれにするか | **回答済み（2026-08-22）: A案**。`engines.node` を #19 の workflow が読むバージョン指定の正とする |
| ユーザー | ADR-0002 を A〜C のどの方法で扱うか | **回答済み（2026-08-22）: A案**。ADR-0018 で置き換える |

## 議論ログ

- 2026-08-22: Issue #42、既存 ADR、検討記録、現行設定、AWS / GitHub / npm / Node.js の公式資料を確認した。Issue 起票後に ADR-0017 で配備方式が変わり、Amplify はビルドせず GitHub Actions が静的成果物をビルドする前提になったことを確認した。
- 2026-08-22: 固定方法は、`frontend/package.json` を `actions/setup-node` の `node-version-file` として使う A案を推奨した。ADR-0002 は新しい ADR で置き換える案を推奨した。ユーザー判断待ち。
- 2026-08-22: ユーザーから両論点とも A案を採用する回答を受領した。ADR-0018 へ昇格し、ADR-0002 のステータスと依存 ADR の参照を整合させる。

## 結論

次を決定した。

1. フロントエンドの Node.js は 24.x を維持する。
2. `frontend/package.json` の `engines.node: "24.x"` を、Node.js バージョンの宣言兼 GitHub Actions が読むバージョン指定の正とする。
3. #19 の GitHub Actions workflow は `actions/setup-node` の `node-version-file` に `frontend/package.json` を指定する。Amplify は静的成果物を受け取るだけのため、ライブパッケージ更新と `amplify.yml` による Node.js バージョン指定は行わない。
4. Dockerfile の `node:24-*` はローカル開発の実体として `engines.node` と同じメジャーバージョンを維持する。
5. ADR-0018 を作成して ADR-0002 を置き換え、ADR-0006 の依存先を ADR-0018 へ付け替える。

**決め手**は、現行の ADR-0017 ではビルド責務が Amplify ではなく GitHub Actions にあることと、既存の `engines.node` を CI の実入力にすることでバージョン値の重複を最小化できることである。

**見送った案**:

- workflow に `24.x` を直接書く案: `package.json`、workflow、Dockerfile の3箇所へ同じメジャーバージョンを持つため、更新漏れの余地が増える。
- `.nvmrc` などを追加する案: ホストで Node.js を使わない現行開発フローでは利用者がなく、同じ値を持つファイルだけが増える。
- Docker コンテナで CI ビルドする案: 開発環境との一致は強いが、#19 の成果物取り出しとキャッシュを複雑にする。
- Amplify のライブパッケージ更新または `amplify.yml` を使う案: Git 非接続の直接配備方式では Amplify がビルドしないため、現在の実行バージョンに影響しない。
- ADR-0002 の直接改訂または補足 ADR として残す案: Vercel 前提の旧判断と GitHub Actions 前提の新判断が混在し、決定の正本が分かりにくくなる。

**次アクション**:

1. [ADR-0018](../ADR/0018-GitHubActionsのNodeバージョン.md) へ昇格し、ADR-0002 / ADR-0006 / ADR-0012 / ADR-0017 の参照を整合させる。
2. #19 で GitHub Actions workflow に `node-version-file: frontend/package.json` を実装し、初回ビルドログの `node --version` で 24.x を確認する。
3. `CLAUDE.md` と `frontend/Dockerfile` の旧デプロイ方式に関する記述は、#19 または別のドキュメント整合タスクで更新する。
