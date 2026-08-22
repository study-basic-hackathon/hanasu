# 検討: Amplify Hosting の IaC 管理範囲とデプロイ方式

- ステータス: 完了
- **昇格先**: [ADR-0016 Amplify の手動配備と CloudFront 経由でフロントエンドと API を公開する](../ADR/0016-Amplifyの手動配備とCloudFront経由のAPI公開.md) — 決定内容はこちらが正本
- **仕様の正本**: 実装範囲・手順は各実装 Issue とその PR を正本とする。本記録は決定に至る経緯であり、現行仕様ではない
- 区分: **必須と任意が混在**（デプロイ方式・管理境界・CloudFront 経由の API 公開方法は、#19 と #92 の着手を左右する必須事項。地理的制限やヘッダーのローテーション方法は任意）
- 開始日: 2026-08-22
- 最終更新: 2026-08-22
- 関連: [#87](https://github.com/study-basic-hackathon/hanasu/issues/87)、[ADR-0012](../ADR/0012-フロントエンドデプロイ先.md)、[#19](https://github.com/study-basic-hackathon/hanasu/issues/19)、[#89](https://github.com/study-basic-hackathon/hanasu/issues/89)、[#90](https://github.com/study-basic-hackathon/hanasu/issues/90)、[#92](https://github.com/study-basic-hackathon/hanasu/issues/92)

## 背景・きっかけ

[#87](https://github.com/study-basic-hackathon/hanasu/issues/87) は、ADR-0012 で採用済みの Amplify Hosting について、Terraform と AWS コンソールの管理境界、GitHub 連携、デプロイ方式、API 接続先の扱いを決めるために起票された。

今回の方針は、Amplify を Git リポジトリに接続せず、ローカルでビルドした静的成果物の ZIP を Amplify コンソールから手動配備する方式である。GitHub Actions によるデプロイは採用しない。公開環境の API は、CloudFront を現在の internet-facing ALB の前段に置き、CloudFront の HTTPS URL 経由で接続する案を検討する。Cognito は利用しないため、Cognito 関連の Amplify 環境変数・リソースは対象外とする。

## 論点

- 必須: Amplify ネイティブの Git ブランチデプロイと、コンソールからの手動配備のどちらを採用するか。
- 必須: Amplify App・branch・IAM・環境変数・GitHub 接続を、Terraform / GitHub / AWS コンソールのどこで管理するか。
- 必須: CloudFront の HTTPS URL を API URL とし、既存の public ALB を origin とするか。
- 必須: CloudFront のみが ALB へ転送できるようにする、ALB listener / security group の制限方法。
- 必須: CloudFront のドメインと Amplify のドメインが異なる前提で、CORS に許可する Amplify Origin をどの構成値から ECS へ渡すか。
- 任意: 地理的制限、手動 ZIP 作成・アップロード、origin header のローテーションの具体的な運用手順。

## 事実確認（出典付き）

- フロントエンドのデプロイ先は Amplify Hosting であり、Next.js 16.3 は Amplify Hosting compute の公式サポート対象外のため、静的出力を前提に扱う。出典: [ADR-0012](../ADR/0012-フロントエンドデプロイ先.md)。
- 現在のフロントエンドは Next.js であり、デプロイ用 API URL の公開環境変数名として #89 は `NEXT_PUBLIC_API_BASE_URL` を完了条件に定めている。出典: [`frontend/package.json`](../../frontend/package.json)、[#89](https://github.com/study-basic-hackathon/hanasu/issues/89)。したがって、Vite 用の `VITE_API_ENDPOINT` は使用しない。
- 現在の `infra/dev/` には CloudFront ディストリビューションおよび HTTPS リスナーがなく、ALB は HTTP (80) のみを公開している。出典: [`infra/dev/alb.tf`](../../infra/dev/alb.tf)。
- Amplify は Git プロバイダに接続せず、コンソールで build output の ZIP をドラッグ&ドロップして手動配備できる。手動配備は SSR をサポートしない。ZIP は build output の最上位フォルダではなく、その**中身**をルートに含める必要がある。出典: [AWS Amplify の Git 非接続デプロイ](https://docs.aws.amazon.com/amplify/latest/userguide/manual-deploys.html)。
- Git 連携で Terraform から Amplify App を作成する場合は `repository` とトークンが必要で、GitHub のトークンは webhook と deploy key の作成にも使われる。出典: [Terraform `aws_amplify_app`](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/amplify_app)、[AWS の GitHub 連携手順](https://docs.aws.amazon.com/amplify/latest/userguide/setting-up-GitHub-access.html)。
- Amplify の既定ドメインは `https://<branch>.<app-id>.amplifyapp.com` であり、HTTPS で配信される。出典: [AWS Amplify のカスタムドメイン](https://docs.aws.amazon.com/amplify/latest/userguide/custom-domains.html)。ブラウザは HTTPS ページから HTTP への `fetch()` / `XMLHttpRequest` を mixed content としてブロックする。出典: [MDN: Mixed content](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Mixed_content)。
- CloudFront は ALB を origin にでき、origin custom header と ALB listener rule を組み合わせて直接アクセスを防止できる。ただし、header 条件の forward rule に加え、listener の default action を固定 403 に変更する必要がある。出典: [AWS: ALB へのアクセス制限](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/restrict-access-to-load-balancer.html)。
- CloudFront の managed prefix list を ALB security group の inbound rule に使うと、CloudFront 以外が ALB へ到達することをネットワーク層でも防げる。出典: [AWS: ALB へのアクセス制限](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/restrict-access-to-load-balancer.html)。
- `CachingDisabled` (ID: `4135ea2d-6df8-44a3-9df3-4b5a84be39ad`) は TTL をすべて 0 にするため、認証付き API に適する。`AllViewerExceptHostHeader` (ID: `b689b0a8-53d0-40ab-baf2-68738e2966ac`) は viewer の `Host` 以外の全 header・cookie・query string を origin に転送する。出典: [AWS: managed cache policies](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-cache-policies.html)、[AWS: managed origin request policies](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-origin-request-policies.html)。
- 現行の `infra/dev/` は `local.shared.alb_dns_name` / `local.shared.alb_listener_arn` を定義していない。同じ Terraform state 内で CloudFront を追加するなら `aws_lb.main.dns_name` / `aws_lb_listener.http.arn` を参照する必要がある。出典: [`infra/dev/locals.tf`](../../infra/dev/locals.tf)、[`infra/dev/alb.tf`](../../infra/dev/alb.tf)。

## 選択肢の比較

| 観点 | A案: Amplify ネイティブ Git ブランチデプロイ | B案: Amplify コンソールからの手動配備 |
|---|---|---|
| ビルド主体 | Amplify | ローカルの Docker 開発環境 |
| GitHub 連携 | 必要。GitHub App とトークンを扱う | 不要。App に `repository` を設定しない |
| 秘密情報の扱い | 連携用トークンを安全な注入経路で一時的に渡す必要がある | GitHub PAT・AWS デプロイ用アクセスキーとも不要 |
| IaC 管理 | App / branch に加え Git 連携設定の扱いを決める必要がある | App / branch のみ Terraform 管理。コンソールは ZIP のアップロードと配備状態の確認だけに使う |
| ビルド設定 | `amplify.yml` または Amplify コンソール | ローカルで `NEXT_PUBLIC_API_BASE_URL` を指定して `next build`。`amplify.yml` は不要 |
| API URL のビルド時注入 | Amplify App/branch の環境変数から渡す | ローカルビルド時の環境変数として渡す |
| 今回との整合 | GitHub 接続を持たない方針と合わない | ユーザーの「基本手動」方針と一致 |

## 懸念

| 懸念 | 深刻度の感触 | 解消に必要な確認 |
|---|---|---|
| Next.js の静的出力設定が未実装のまま | 高 | #19 で `output: 'export'` と `out/` を成果物にすることを確認する |
| HTTPS の Amplify 画面から HTTP ALB API を呼ぶ | 高 | ブラウザが mixed content としてブロックする。HTTPS 化を行わないなら、公開環境での API 疎通は完了条件から外す必要がある |
| Amplify の環境変数を手動配備でもビルド時に使えると誤解する | 高 | B案ではローカルビルド時の `NEXT_PUBLIC_API_BASE_URL` を唯一の注入経路とする |
| 提示 IaC の `AdministratorAccess-Amplify` をそのまま付与する | 中 | 静的な手動配備に Amplify のサービスロールは不要とし、作成しない |
| header 条件 rule を足しても ALB default action が forward のまま | 高 | default action を fixed 403 に変更し、origin header が一致する rule だけを target group へ forward する |
| ALB security group が `0.0.0.0/0:80` のまま | 高 | CloudFront managed prefix list に限定する。header 条件と併用して二層で制限する |
| CloudFront→ALB が `http-only` | 高 | viewer→CloudFront の HTTPS は成立し mixed content は解消するが、origin header・Bearer token・API本文がこの区間では暗号化されない。ALB HTTPS listener は本件で扱わない前提を明示して受け入れる |
| `SecureString` に保存しても Terraform state から secret が消えると誤解する | 中 | CloudFront と listener rule の設定値として state に保持される。SSM parameter は現状で参照者がなく、保存目的を別途定めるまで作成しない |
| JP / US の geo whitelist | 中 | 要件として未提示。採用するとそれ以外の国を 403 にするため、現時点では `none` を推奨 |

## お客様・関係者と詰めるべき事項

| 確認相手 | 確認内容 | 回答が決定にどう効くか |
|---|---|---|
| チーム | B案（Amplify コンソールからの手動配備）を正式採用するか | #19 / #92 の実装前提と ADR の結論になる |
| ユーザー | CloudFront→ALB の HTTP 区間を今回のスコープ外として受け入れるか | 受け入れるなら、CloudFront の viewer 側 HTTPS と header / prefix list による到達制限までを実装対象とする |
| API インフラ担当 | Amplify の branch domain を `CORS_ALLOWED_ORIGINS` として ECS task に渡す担当 Issue | #90 の CORS 実装後に公開環境で API 疎通できるかを左右する |

## 議論ログ

- 2026-08-22: ユーザーから、リポジトリ接続なし・GitHub Actions が `CreateDeployment` / 署名付き ZIP アップロード / `StartDeployment` を呼ぶ方式を前提に検討したいとの提案。Cognito を使わないことを明示。
- 2026-08-22: リポジトリと AWS 公式資料を確認。直接デプロイは Git 非接続 App 向けであり、Amplify ビルドおよび `amplify.yml` は実行されないことを確認。Next.js の公開 API URL は #89 に合わせて `NEXT_PUBLIC_API_BASE_URL` を GitHub Actions のビルド時に渡す必要があると整理。
- 2026-08-22: ユーザーから GitHub Actions デプロイを採用せず「基本手動」とすること、HTTPS 化を本件の範囲から外し、現行 ALB への接続だけを対象とすることを回答として受領。B案をコンソールからの ZIP 手動配備へ変更した。
- 2026-08-22: Amplify は既定で HTTPS 配信されるため、HTTP の現行 ALB へのブラウザ API 呼び出しは mixed content により成立しないことを確認。公開環境で API 疎通を要求しないか、HTTPS 化を別 Issue とするかは未決。
- 2026-08-22: ユーザーから CloudFront を同時に追加する方針と、origin custom header、`CachingDisabled`、`AllViewerExceptHostHeader`、CloudFront default certificate を用いる Terraform 案を受領。CloudFront の HTTPS URL を API URL とすることで mixed content は解消する。
- 2026-08-22: 現行 ALB の listener default action は forward、security group は `0.0.0.0/0:80` であることを確認。header 条件 rule だけでは直接 ALB アクセスを遮断できず、default action の固定 403 と CloudFront managed prefix list への ingress 限定が必要と整理。
- 2026-08-22: ユーザーは、公開経路を Amplify (HTTPS) → CloudFront (HTTPS) → 現行 ALB (HTTP) → ECS とし、CloudFront→ALB の HTTP 区間を今回受容すると決定。ALB の直接アクセスは CloudFront managed prefix list、origin custom header、default 403 で制限する。GitHub Actions、Cognito、地理的制限、未使用 SSM parameter は採用しない。

## 結論

次を決定した。

1. Amplify App は Git 非接続の静的ホスティングとして Terraform で作成し、ローカルでビルドした `out/` の中身を ZIP にして Amplify コンソールから手動配備する。GitHub Actions、GitHub 連携、`amplify.yml`、Cognito、Amplify サービスロール、`AdministratorAccess-Amplify` は作成しない。
2. API の公開 URL は CloudFront default domain の HTTPS URL とする。CloudFront は現行 public ALB を HTTP origin とし、動的 API のため `CachingDisabled` と `AllViewerExceptHostHeader` を使う。地理的制限は設定しない。
3. ALB への直接アクセスは、CloudFront managed prefix list に限定した security group、CloudFront 専用の origin custom header、header 不一致時の listener default fixed 403 の三層で制限する。origin custom header の値は Terraform が生成し、実行時に参照しないため SSM Parameter Store には保存しない。
4. CloudFront→ALB の HTTP 区間は今回のスコープで受容する。この区間は暗号化されないため、ALB HTTPS listener と独自 API ドメインは必要になった時点で別 Issue として再検討する。
5. フロントエンドは `NEXT_PUBLIC_API_BASE_URL=https://<CloudFront domain>` をローカルビルド時に与える。CORS は Amplify branch domain を ECS の `CORS_ALLOWED_ORIGINS` に渡して許可する。
