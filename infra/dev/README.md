# dev環境 運用手順(apply → 動作確認 → destroy)

FastAPIサンプルアプリをECS Fargate上で動かすためのdev環境の、構築から破棄までの一連の手順です。

## 前提条件

| 項目 | 値 |
|---|---|
| AWS認証 | プロファイル `hanasu`(`AWS_PROFILE=hanasu`) |
| Terraformバージョン | `= 1.15.8`(`versions.tf`で固定) |
| state保存先 | S3バケット `hanasu-terraform-state-926046660554`(`infra/bootstrap`で事前作成) |
| AWSアカウントID | `926046660554` |
| リージョン | `ap-northeast-1` |

以降のコマンドはすべて `infra/dev` ディレクトリで実行します。

```bash
cd infra/dev
export AWS_PROFILE=hanasu
```

## 1. Terraformでインフラを構築(apply)

```bash
terraform init
terraform plan
terraform apply
```

`apply`が完了すると、以下の値が出力されます(`outputs.tf`)。

- `alb_dns_name` … アプリへのアクセスURL
- `ecr_repository_url` … イメージのpush先
- `ecs_cluster_name` / `ecs_service_name` … ECS操作時に使う名前

> **注意**: `apply`直後はECSサービスがECRリポジトリ内の`:latest`イメージを起動しようとしますが、初回はイメージが存在しないためタスクが起動失敗を繰り返します。次の手順でイメージをpushしてください。

## 2. コンテナイメージのビルド & ECRへpush

ECRへのログインは認証トークン発行後12時間有効です。トークンが切れていない限り、この手順は毎回不要です。

```bash
aws ecr get-login-password --region ap-northeast-1 \
  | docker login --username AWS --password-stdin 926046660554.dkr.ecr.ap-northeast-1.amazonaws.com

ECR_REPO=$(terraform output -raw ecr_repository_url)

# provenance/sbom付きでbuildするとECRへのpushが403で失敗することがあるため無効化する
docker build --provenance=false --sbom=false -t hanasu-api ./example-backend
docker tag hanasu-api:latest "$ECR_REPO:latest"
docker push "$ECR_REPO:latest"
```

`example-backend`はコンテナ起動時に`alembic upgrade head`→シーダー(`seed.py`)→`uvicorn`起動の順に実行する。DB接続情報(`DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USERNAME`/`DB_PASSWORD`)はECSタスク定義から環境変数として渡している(`DB_USERNAME`/`DB_PASSWORD`はRDSのマスターパスワードSecretから注入)。動作確認は`curl http://<alb_dns_name>/items`で行う。

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
curl http://$(terraform output -raw alb_dns_name)/
curl http://$(terraform output -raw alb_dns_name)/items
```

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
