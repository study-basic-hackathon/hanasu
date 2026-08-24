# dev環境 運用手順(apply → 動作確認 → destroy)

FastAPIサンプルアプリをECS Fargate上で動かすためのdev環境の、構築から破棄までの一連の手順です。

フロントエンドは Git 非接続の Amplify Hosting に、GitHub Actions が静的ファイルの ZIP を直接配備する。API は CloudFront の HTTPS ドメインから公開し、CloudFront は既存 ALB へ HTTP で転送する。ALB は CloudFront managed prefix list と origin custom header により直接アクセスを遮断する。

## 前提条件

| 項目                | 値                                                                            |
| ------------------- | ----------------------------------------------------------------------------- |
| AWS認証             | プロファイル `hanasu`(`AWS_PROFILE=hanasu`)                                   |
| Terraformバージョン | `= 1.15.8`(`versions.tf`で固定)                                               |
| state保存先         | S3バケット `hanasu-terraform-state-926046660554`(`infra/bootstrap`で事前作成) |
| AWSアカウントID     | `926046660554`                                                                |
| リージョン          | `ap-northeast-1`                                                              |

以降のコマンドはすべて `infra/dev` ディレクトリで実行します。

```bash
cd infra/dev
export AWS_PROFILE=hanasu
```

### origin custom header の扱い

CloudFront と ALB listener rule が照合する header 値は `random_password.cloudfront_origin_header` で生成する。値はコード、コミット対象の `terraform.tfvars`、Terraform output には保存しない。Terraform state には機微値として保存されるため、state の S3 バケットおよびアクセス権限を保護すること。

このリソースを `taint`、`state rm`、削除しない限り、header 値は同じ state で維持される。header を意図的にローテーションする場合は、CloudFront と ALB listener rule が同じ apply で更新されることを plan で確認する。

## 1. Terraformでインフラを構築(apply)

```bash
terraform init
terraform plan
terraform apply
```

`apply`が完了すると、以下の値が出力されます(`outputs.tf`)。

- `alb_dns_name` … CloudFront だけが接続できる ALB のドメイン名
- `ecr_repository_url` … イメージのpush先
- `ecs_cluster_name` / `ecs_service_name` … ECS操作時に使う名前
- `amplify_app_id` / `amplify_app_url` / `amplify_branch_url` … Amplify の直接配備・公開先に使う値
- `github_actions_amplify_deploy_role_arn` … GitHub Actions が Amplify 配備専用に引き受ける OIDC ロール
- `github_actions_backend_deploy_role_arn` … GitHub Actions がバックエンドの ECR/ECS 配備専用に引き受ける OIDC ロール
- `api_cloudfront_url` … フロントエンドの `NEXT_PUBLIC_API_BASE_URL` に指定する HTTPS の API URL

> **注意**: `apply`直後はECSサービスがECRリポジトリ内の`:latest`イメージを起動しようとしますが、初回はイメージが存在しないためタスクが起動失敗を繰り返します。次の手順でイメージをpushしてください。

ECSタスク定義は常にリポジトリ直下の `backend/`(本実装)を動かす。`bedrock:InvokeModel`権限を持つECSタスクロール(`aws_iam_role.ecs_task`)がタスクに割り当てられ(Bedrock呼び出し用)、RDSのマスターパスワードから組み立てた`DATABASE_URL`と`JWT_SECRET_KEY`をSecrets Manager経由で注入する(`infra/dev/secrets.tf`)。

## 2. コンテナイメージのビルド & ECRへpush

ECRへのログインは認証トークン発行後12時間有効です。トークンが切れていない限り、この手順は毎回不要です。

```bash
aws ecr get-login-password --region ap-northeast-1 \
  | docker login --username AWS --password-stdin 926046660554.dkr.ecr.ap-northeast-1.amazonaws.com

ECR_REPO=$(terraform output -raw ecr_repository_url)

# provenance/sbom付きでbuildするとECRへのpushが403で失敗することがあるため無効化する
docker build --provenance=false --sbom=false -t hanasu-api ../../backend
docker tag hanasu-api:latest "$ECR_REPO:latest"
docker push "$ECR_REPO:latest"
```

`backend/`はコンテナ起動時に`alembic upgrade head`→`uvicorn`起動の順に実行する。DB接続情報は`DATABASE_URL`(Secrets Manager経由)で渡している。動作確認は`curl $(terraform output -raw api_cloudfront_url)/health`で行う(`api_cloudfront_url`は`https://`込みの値なので先頭に重ねて付けない)。

## GitHub Actionsによるbackend手動配備の初期設定

Terraform apply 後、リポジトリの GitHub Actions Variables に以下を設定する。値はすべて `terraform output` から取得でき、GitHub Secrets に長期 AWS アクセスキーを保存しない。

| Variable | 値 |
|---|---|
| `AWS_REGION` | `ap-northeast-1` |
| `AWS_BACKEND_ROLE_TO_ASSUME` | `terraform output -raw github_actions_backend_deploy_role_arn` |
| `ECR_REPOSITORY_URL` | `terraform output -raw ecr_repository_url` |
| `ECS_CLUSTER_NAME` | `terraform output -raw ecs_cluster_name` |
| `ECS_SERVICE_NAME` | `terraform output -raw ecs_service_name` |
| `BACKEND_API_BASE_URL` | `terraform output -raw api_cloudfront_url` |

`AWS_BACKEND_ROLE_TO_ASSUME` のロールは `study-basic-hackathon/hanasu` の `main` ブランチの OIDC token だけを信頼する。ECR認証と対象リポジトリへのイメージpush、および対象ECSサービスの `UpdateService` / `DescribeServices` だけを許可し、Terraform の `plan` / `apply` / `destroy` 権限は付与しない。

手動配備は GitHub の **Actions > Deploy backend to Amazon ECS > Run workflow** から `main` ブランチを選択して実行する。push や pull request を契機とした自動実行は行わず、`main` 以外を選択すると設定検証で停止する。ワークフローは次の順序で処理する。

1. backendの単体テストを実行する
2. `backend/Dockerfile` から `--provenance=false --sbom=false` でイメージをbuildする
3. ECRへ `:latest` としてpushする
4. ECSサービスを `--force-new-deployment` で更新し、安定化を待つ
5. CloudFront経由の `/health` が成功することを確認する

このワークフローは本書の手順2〜4を自動化する。ローカルのコマンドは初回イメージpushや障害時の手動復旧手段として引き続き利用できる。同時実行は抑止され、実行結果、commit SHA、image URI、ECS cluster/service、各処理の成否は GitHub Actions の job summary に記録される。

### backend配備が失敗した場合

| 失敗箇所 | 確認事項 |
|---|---|
| 設定検証 | 6個の GitHub Actions Variables が設定済みか、`main` ブランチを選択したかを確認する |
| AWS認証 | `github_actions_backend_deploy_role_arn` を反映する Terraform apply が完了しているか、OIDCロールARNを正しく設定したかを確認する |
| ECR push | `ECR_REPOSITORY_URL` がタグなしの正しいURLか、対象ECRリポジトリが存在するかを確認する |
| ECS安定化待ち | ECSサービスの Events、停止タスクの理由、CloudWatch Logs の `/ecs/hanasu-dev-api` を確認する |
| `/health` | `BACKEND_API_BASE_URL` が `api_cloudfront_url` と一致するか、CloudFront・ALB・target groupの状態を確認する |

ワークフローがECRへのpush後に失敗した場合でも、ECSサービスが正常に安定していることを確認するまでは配備完了とみなさない。ECSのログ確認には次のコマンドを利用できる。

```bash
aws logs tail /ecs/hanasu-dev-api --since 30m --follow
```

## GitHub ActionsによるAmplify直接配備の初期設定

Terraform apply 後、リポジトリの GitHub Actions Variables に以下を設定する。値はすべて `terraform output` から取得でき、GitHub Secrets に長期 AWS アクセスキーを保存しない。

| Variable | 値 |
|---|---|
| `AWS_REGION` | `ap-northeast-1` |
| `AWS_ROLE_TO_ASSUME` | `terraform output -raw github_actions_amplify_deploy_role_arn` |
| `AMPLIFY_APP_ID` | `terraform output -raw amplify_app_id` |
| `AMPLIFY_BRANCH_NAME` | `main`（`terraform.tfvars` の `amplify_branch_name`） |
| `NEXT_PUBLIC_API_BASE_URL` | `terraform output -raw api_cloudfront_url` |

ロールは `study-basic-hackathon/hanasu` の `main` ブランチの OIDC token だけを信頼し、`CreateDeployment`、`StartDeployment`、`GetJob`、`GetBranch` だけを Amplify branch に許可する。Terraform の `plan` / `apply` / `destroy` 権限は付与しない。

Next.js の静的出力と、`out/` の中身を ZIP 化して Amplify へ直接配備する GitHub Actions workflow は #19 の担当範囲であり、このディレクトリでは管理しない。配備後は `amplify_branch_url` がフロントエンドの公開 URL になる。CloudFront は HTTPS を受け付け、ALB への転送は ADR-0017 で受容した HTTP 区間である。

## 3. ECSに最新イメージを反映

タスク定義は`:latest`タグを固定参照しているため、pushしただけではterraform上差分が出ず、稼働中のタスクにも反映されません。強制的に新しいイメージをpullさせます。

```bash
aws ecs update-service \
  --cluster "$(terraform output -raw ecs_cluster_name)" \
  --service "$(terraform output -raw ecs_service_name)" \
  --force-new-deployment
```

## 4. 動作確認

```bash
terraform output alb_dns_name
curl -I http://$(terraform output -raw alb_dns_name)/
curl -I https://$(terraform output -raw api_cloudfront_domain_name)/
```

ALB の直接アクセスは 403 になる。API の動作確認は CloudFront の `api_cloudfront_url` 経由で行う。CloudFront distribution の反映には時間がかかることがある。

ECSタスクの状態確認:

```bash
aws ecs describe-services \
  --cluster "$(terraform output -raw ecs_cluster_name)" \
  --services "$(terraform output -raw ecs_service_name)"
```

### RDSへの接続情報

マスターパスワードはRDSが自動生成しSecrets Managerに保存している(`manage_master_user_password = true`)。エンドポイントとシークレットARNは`terraform output`から取得できる。

```bash
terraform output rds_endpoint
aws secretsmanager get-secret-value \
  --secret-id $(terraform output -raw rds_master_user_secret_arn) \
  --query SecretString --output text | jq .
```

RDSは`aws_subnet.private`(IGWへのルートを持たないサブネット)に配置しており、`aws_security_group.rds`により`aws_security_group.ecs_task`からのアクセスのみ許可している。外部やインターネットからは到達不可。

## 5. インフラの破棄(destroy)

```bash
terraform destroy
```

- `aws_ecr_repository.api`には`force_delete = true`が設定されているため、リポジトリ内にイメージが残っていてもエラーなく削除できます。
- 一部リソースだけ壊したい場合は`-target`で絞り込みます(例: ECRだけ削除したい場合)。

  ```bash
  terraform destroy -target=aws_ecr_repository.api
  ```

- `terraform destroy`の削除対象は`.tf`ファイルの定義ではなく**stateに記録されているリソース**です。state自体は`infra/dev/versions.tf`の`backend "s3"`設定に従い、S3バケット`hanasu-terraform-state-926046660554`(`key = ecs/terraform.tfstate`)に保存されています。
- `infra/bootstrap`(state保存用S3バケット)は完全に別のstateなので、この`destroy`では影響を受けません。

## 再度applyする場合

上記1〜4を再実行します。`.tf`を編集して既存リソースを更新するだけであれば、`destroy`を挟まず`apply`のみで差分反映されます(`terraform plan`で`-/+`が出ない限り、作り直しは発生しません)。
