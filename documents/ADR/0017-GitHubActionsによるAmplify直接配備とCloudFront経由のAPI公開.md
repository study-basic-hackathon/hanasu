# ADR-0017: GitHub Actions による Amplify 直接配備と CloudFront 経由の API 公開

- ステータス: 決定
- 日付: 2026-08-22
- 置き換える ADR: [ADR-0016](0016-Amplifyの手動配備とCloudFront経由のAPI公開.md)
- 依存: [ADR-0012](0012-フロントエンドデプロイ先.md)（フロントエンドのデプロイ先は Amplify Hosting）
- 被依存: [#19](https://github.com/study-basic-hackathon/hanasu/issues/19)、[#89](https://github.com/study-basic-hackathon/hanasu/issues/89)、[#90](https://github.com/study-basic-hackathon/hanasu/issues/90)、[#92](https://github.com/study-basic-hackathon/hanasu/issues/92)

## コンテキスト（背景と課題）

ADR-0016 は、Terraform の適用もフロントエンド配備も GitHub Actions を使わないものとしていた。しかし、GitHub Actions を使わない対象は Terraform の `apply` / `destroy` であり、フロントエンドの静的成果物は GitHub Actions から Amplify へ配備する必要があることが確認された。

Amplify の既定ドメインは HTTPS のため、既存 ALB の HTTP URL をブラウザから直接呼ぶと mixed content になる。フロントエンドは CloudFront の HTTPS URL を API 接続先とし、ALB の直接公開も抑止する必要がある。

## 決定

### Terraform と GitHub Actions の責務境界

- Terraform の `plan` / `apply` / `destroy` は GitHub Actions workflow に含めない。インフラ変更の適用は既存の手動運用で行う。
- Terraform は Git 非接続の Amplify App・branch、API 用 CloudFront、ALB 直接アクセス制限、および GitHub Actions の Amplify 配備専用 IAM ロールと最小権限ポリシーを管理する。
- Amplify App に `repository`、GitHub App 接続、アクセストークン、`amplify.yml`、Cognito 関連設定、Amplify サービスロール、`AdministratorAccess-Amplify` は設定しない。

### フロントエンドの配備

- `main` への変更を契機に、GitHub Actions が Next.js の静的出力をビルドし、Git 非接続 Amplify App の対象 branch へ直接配備する。
- GitHub Actions は OIDC で Amplify 配備専用ロールを引き受ける。長期 AWS アクセスキーを GitHub Secrets に保存しない。許可する Amplify 操作は `CreateDeployment`、`StartDeployment`、`GetJob`、`GetBranch` に限定する。
- workflow は `out/` ディレクトリの**中身**を ZIP 化し、`CreateDeployment` が返す `zipUploadUrl` へ PUT した後、`StartDeployment` を呼ぶ。S3 を中継しない。
- `NEXT_PUBLIC_API_BASE_URL` は GitHub Actions のビルド時に CloudFront の HTTPS URL として注入する。Amplify の環境変数は、この外部ビルド方式の注入経路に使わない。

### API の公開経路

- 公開経路は Amplify（HTTPS）→ CloudFront（HTTPS）→ 既存 ALB（HTTP）→ ECS とする。CloudFront→ALB の HTTP 区間は今回受容する。
- CloudFront は認証・動的応答をキャッシュせず、`CachingDisabled` と `AllViewerExceptHostHeader` の AWS managed policy を使う。地理的制限、独自ドメイン、viewer 用 ACM 証明書は追加しない。
- ALB security group の HTTP inbound は CloudFront managed prefix list に限定する。CloudFront origin custom header が一致する listener rule だけを target group へ forward し、listener の default action は fixed response 403 とする。
- origin custom header は Terraform が生成する。実行時に読むコンポーネントがないため SSM Parameter Store に複製しない。Terraform state は秘密情報として扱う。

### CORS

- ブラウザの Origin は Amplify branch domain、接続先は CloudFront domain となる。FastAPI の `CORS_ALLOWED_ORIGINS` には Terraform で生成される Amplify branch domain を渡す。
- CORS middleware の実装は #90、ECS task definition への値の注入は #92 が担う。

## 決定要因

- インフラ適用権限とフロントエンド配備権限を分離できること
- GitHub リポジトリを Amplify に接続せず、CI のビルド成果物を一貫して配備できること
- GitHub Actions に長期 AWS 認証情報を置かず、配備 API のみを最小権限で実行できること
- Amplify の HTTPS ページから CloudFront の HTTPS API を呼び、ALB の直接公開を抑止できること

## 影響・トレードオフ

- `main` の変更ごとに GitHub Actions が配備するため、手動 ZIP 配備より再現性と追跡性は上がる。一方で、workflow の AWS 認可設定と配備失敗時の復旧手順を維持する必要がある。
- CloudFront→ALB の HTTP 区間では API 本文、Bearer token、origin custom header が暗号化されない。この受容はハッカソン期間の暫定判断であり、ALB HTTPS listener・独自 API ドメインが必要になった時点で再検討する。
- CloudFront と Amplify の domain が異なるため CORS 設定が必須となる。

## フォローアップ

- [#92](https://github.com/study-basic-hackathon/hanasu/issues/92) で Amplify / CloudFront / ALB listener / security group / ECS の CORS 環境変数、および GitHub Actions 配備用 OIDC ロール・最小権限ポリシーを Terraform に追加する。
- [#89](https://github.com/study-basic-hackathon/hanasu/issues/89) で `NEXT_PUBLIC_API_BASE_URL` をフロントエンドの唯一の API 接続先設定とし、GitHub Actions のビルド時に注入できるようにする。
- [#90](https://github.com/study-basic-hackathon/hanasu/issues/90) で Amplify branch domain を許可する CORS 設定を実装する。
- [#19](https://github.com/study-basic-hackathon/hanasu/issues/19) で Next.js の静的出力と GitHub Actions による Amplify 直接配備 workflow を整備する。

## 備考

比較、AWS 公式資料、議論ログは [検討記録: Amplify Hosting の IaC 管理範囲とデプロイ方式](../00_検討/20260822_AmplifyHostingのIaC管理範囲とデプロイ方式.md) を参照。
