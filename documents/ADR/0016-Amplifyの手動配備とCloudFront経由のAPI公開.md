# ADR-0016: Amplify の手動配備と CloudFront 経由でフロントエンドと API を公開する

- ステータス: ADR-0017 により置き換え
- 日付: 2026-08-22
- 依存: [ADR-0012](0012-フロントエンドデプロイ先.md)（フロントエンドのデプロイ先は Amplify Hosting）
- 被依存: [#19](https://github.com/study-basic-hackathon/hanasu/issues/19)、[#89](https://github.com/study-basic-hackathon/hanasu/issues/89)、[#90](https://github.com/study-basic-hackathon/hanasu/issues/90)、[#92](https://github.com/study-basic-hackathon/hanasu/issues/92)

## コンテキスト(背景と課題)

ADR-0012 により、Next.js フロントエンドの配信先は Amplify Hosting と決定済みである。Next.js 16.3 を静的出力として手動配備したい一方、既存 FastAPI は internet-facing ALB の HTTP listener で公開されている。

Amplify の既定ドメインは HTTPS のため、ALB の HTTP URL をブラウザから直接呼ぶと mixed content でブロックされる。ブラウザから HTTPS で API を呼び、同時に ALB の直接アクセスを抑止する公開経路を決める必要がある。

## 決定

### フロントエンドの配備

- Terraform は Git 非接続の Amplify App と対象 branch を管理する。`repository`、GitHub App 接続、アクセストークン、`amplify.yml`、Cognito 関連設定を持たない。
- Amplify の実行ロールと `AdministratorAccess-Amplify` は作成しない。GitHub Actions も使わない。
- 開発者はローカル Docker で静的出力をビルドし、`out/` ディレクトリの**中身**を ZIP 化して Amplify コンソールから手動配備する。
- `NEXT_PUBLIC_API_BASE_URL` はローカルビルド時に CloudFront domain の HTTPS URL として指定する。Amplify の環境変数は手動配備のビルドには使わない。

### API の公開経路

- CloudFront distribution を Terraform で作成し、既存の `aws_lb.main` を custom origin にする。フロントエンドの API 接続先は CloudFront default domain の HTTPS URL とする。
- Viewer protocol policy は `redirect-to-https`、origin protocol policy は `http-only` とする。CloudFront→ALB の HTTP 区間は今回受容する。
- 認証・動的応答を含む API のため、`CachingDisabled` と `AllViewerExceptHostHeader` の AWS managed policy を使う。これによりキャッシュを無効化し、`Authorization`、`Origin`、CORS preflight の各 header を origin に転送する。
- 地理的制限は設定しない。CloudFront default certificate を用い、独自ドメインと viewer 用 ACM 証明書は作成しない。

### ALB 直接アクセスの制限

- ALB security group の HTTP inbound を `0.0.0.0/0` から CloudFront managed prefix list に変更する。
- CloudFront origin はランダムな custom header を付与し、ALB listener はこの header が一致する rule のみを target group へ forward する。
- listener の default action は fixed response の 403 とする。header rule だけを追加して default forward を残す構成は採らない。
- origin custom header は Terraform が `random_password` で生成する。実行時に値を読むコンポーネントがないため、SSM Parameter Store には複製しない。値は Terraform state に存在するため、state へのアクセス権は秘密情報と同等に扱う。

### CORS

- ブラウザの Origin は Amplify branch domain、接続先は CloudFront domain となる。FastAPI の `CORS_ALLOWED_ORIGINS` には Terraform で生成される Amplify branch domain を渡す。
- CORS middleware の実装は #90、ECS task definition への値の注入は #92 が担う。

## 決定要因

- GitHub 連携用トークン、GitHub Actions の AWS 認証、Amplify の自動ビルドを持ち込まずに手動配備できること
- Amplify の HTTPS ページからブラウザが API を呼べること
- ALB の public DNS を直接 API URL として公開せず、CloudFront 経由に限定できること
- 認証付き API をキャッシュしないこと

## 影響・トレードオフ

- 手動配備のため、`main` の更新で自動デプロイは行われない。配備漏れと ZIP 内容の誤りは運用手順で防ぐ。
- CloudFront→ALB の HTTP 区間では API 本文、Bearer token、origin custom header が暗号化されない。この受容はハッカソン期間の暫定判断であり、ALB HTTPS listener・独自 API ドメインが必要になった時点で再検討する。
- CloudFront と Amplify の domain が異なるため CORS 設定が必須となる。
- origin custom header の値は Terraform state に残る。SSM に複製しても state から値は消えないため、未使用の SecureString は作らない。

## フォローアップ

- [#92](https://github.com/study-basic-hackathon/hanasu/issues/92) で Amplify / CloudFront / ALB listener / security group / ECS の CORS 環境変数を Terraform に追加する。
- [#89](https://github.com/study-basic-hackathon/hanasu/issues/89) で `NEXT_PUBLIC_API_BASE_URL` をフロントエンドの唯一の API 接続先設定とする。
- [#90](https://github.com/study-basic-hackathon/hanasu/issues/90) で Amplify branch domain を許可する CORS 設定を実装する。
- [#19](https://github.com/study-basic-hackathon/hanasu/issues/19) で Next.js の静的出力と手動 ZIP 配備手順を整備する。

## 備考

比較、AWS 公式資料、議論ログは [検討記録: Amplify Hosting の IaC 管理範囲とデプロイ方式](../00_検討/20260822_AmplifyHostingのIaC管理範囲とデプロイ方式.md) を参照。
