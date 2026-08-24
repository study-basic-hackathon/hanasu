# ADR-0019: GitHub Actions の手動実行による Amplify 直接配備

- ステータス: 決定
- 日付: 2026-08-25
- 置き換える ADR: [ADR-0017](0017-GitHubActionsによるAmplify直接配備とCloudFront経由のAPI公開.md)
- 依存: [ADR-0012](0012-フロントエンドデプロイ先.md)（フロントエンドのデプロイ先は Amplify Hosting）
- 被依存: [ADR-0018](0018-GitHubActionsのNodeバージョン.md)（GitHub Actions の Node.js バージョン固定方法）

## コンテキスト（背景と課題）

ADR-0017 は `main` への変更ごとにフロントエンドを自動配備すると決定していた。しかし、リポジトリへのマージと Amplify への配備を同時に行う必要はなく、インフラ変更を手動で適用する運用では、前提となる AWS 設定の反映前に配備が始まる場合がある。配備タイミングを作業者が明示的に選べるようにしつつ、GitHub Actions からの再現可能な直接配備方式は維持する必要がある。

## 決定

### 実行契機

- Amplify 直接配備 workflow は `workflow_dispatch` による手動実行だけを受け付ける。
- `push`、`schedule`、パス条件による自動実行は設定しない。
- OIDC ロールの信頼条件に合わせ、実行時には `main` ブランチを選択する。

### Terraform と GitHub Actions の責務境界

- Terraform の `plan` / `apply` / `destroy` は GitHub Actions workflow に含めず、インフラ変更は手動で適用する。
- Terraform は Git 非接続の Amplify App・branch、API 用 CloudFront、ALB 直接アクセス制限、および GitHub Actions の Amplify 配備専用 IAM ロールと最小権限ポリシーを管理する。
- Amplify App に GitHub 接続、アクセストークン、`amplify.yml`、Cognito、Amplify サービスロール、`AdministratorAccess-Amplify` は設定しない。

### フロントエンドの配備

- GitHub Actions は Next.js の静的出力をビルドし、`out/` の中身を ZIP 化して Git 非接続 Amplify App の対象 branch へ配備する。
- 配備は `CreateDeployment`、署名付き URL への ZIP upload、`StartDeployment`、`GetJob` だけで行い、S3 を中継しない。
- AWS 認証には OIDC の配備専用ロールを使用し、長期 AWS アクセスキーを GitHub Secrets に保存しない。
- `NEXT_PUBLIC_API_BASE_URL` はビルド時に API 用 CloudFront の HTTPS URL として注入する。

### API の公開経路

- 公開経路は Amplify（HTTPS）→ CloudFront（HTTPS）→ ALB（HTTP）→ ECS とする。
- CloudFront は動的応答をキャッシュせず、ALB は CloudFront managed prefix list と origin custom header で直接アクセスを制限する。
- FastAPI の CORS では Amplify branch domain を許可する。

## 検討した選択肢

- A案: `main` への push ごとに自動配備する
- B案: `workflow_dispatch` で選択したタイミングだけ配備する（採用）

## 決定要因

- リポジトリへのマージと公開環境への配備を分離できること
- 手動のインフラ適用後に配備タイミングを選べること
- GitHub Actions の実行履歴と同じ手順による再現性を維持できること
- 不要な配備を発生させないこと

## 理由

手動実行であれば、AWS 側の前提条件を確認した後に作業者が配備を開始でき、フロントエンドに関係しないマージでも配備が走ることを防げる。ローカルから ZIP を手動アップロードする案は、ビルド環境と配備手順の再現性が下がるため採用しない。

## 影響・トレードオフ

- マージだけでは Amplify の配備内容が変わらず、意図しない自動配備を防げる。
- 配備操作と結果は引き続き GitHub Actions の実行履歴に残る。
- 作業者が手動実行を忘れると、`main` と配備済み成果物が一致しない期間が生じる。
- CloudFront→ALB の HTTP 区間と異なる domain 間の CORS は ADR-0017 から引き続き受容する。

## フォローアップ

- `.github/workflows/deploy-frontend-to-amplify.yml` から `push` トリガーを削除する。
- Amplify へ反映する際は、GitHub Actions で対象workflowを `main` から手動実行する。

## 備考

直接配備方式の比較と背景は [検討記録: Amplify Hosting の IaC 管理範囲とデプロイ方式](../00_検討/20260822_AmplifyHostingのIaC管理範囲とデプロイ方式.md) を参照する。
