# Terraform State用 S3バケット (bootstrap)

## 概要

Terraformのstateファイルを保存するためのS3バケットを作成する、初期セットアップ専用の構成です。

- **目的**: 本体側(ECS等)のTerraformが使うstate保存先(S3バケット)そのものを用意する
- **実行タイミング**: 基本的に初回のみ。バケット設定を変更したい時に稀に再実行する
- **stateの管理方法**: このディレクトリ自体は`backend`ブロックを指定せず、**local state**(実行したディレクトリ内に`terraform.tfstate`が生成される)で運用する
  - 理由: 「stateの保存先(S3バケット)」自体をTerraformで作ろうとすると、そのTerraform自身のstateをどこに置くかという循環(鶏卵問題)が発生するため、bootstrap自身のstateはローカルに留める
  - ロック方式: Terraform 1.10以降で対応したS3ネイティブロック(DynamoDB不要)を採用

## 実行環境

| 項目 | 値 | 設定ファイル |
|---|---|---|
| Terraformバージョン | `= 1.15.8` (厳密固定) | `versions.tf` |
| AWSプロバイダバージョン | `~> 6.0` | `versions.tf` |
| リージョン | `ap-northeast-1` | `versions.tf` |
| AWS認証 | プロファイル`hanasu`(`AWS_PROFILE=hanasu`) | ローカルの`~/.aws/credentials`(リポジトリ外) |

## 作成されるリソースの詳細

| リソース | 設定 | 値/内容 | 理由 | 定義ファイル |
|---|---|---|---|---|
| `aws_s3_bucket.terraform_state` | バケット名 | `hanasu-terraform-state-<AWSアカウントID>`(`data.aws_caller_identity`でアカウントIDを動的取得) | S3バケット名はグローバルで一意である必要があるため、アカウントIDをサフィックスにして一意性を確保 | `main.tf` |
| | `lifecycle.prevent_destroy` | `true` | 誤って`terraform destroy`しても、stateの保存先自体が消えないようにする保護 | `main.tf` |
| `aws_s3_bucket_versioning.terraform_state` | バージョニング | `Enabled` | apply時にstateが上書きされる仕組み上、誤ったapply/destroyでstateが壊れた場合に過去バージョンへ復元できるようにする | `main.tf` |
| `aws_s3_bucket_server_side_encryption_configuration.terraform_state` | 暗号化方式 | `AES256`(SSE-S3) | stateファイルにはDBパスワードなど機密情報が平文で記録される場合があるため、保存時暗号化を必須にする | `main.tf` |
| `aws_s3_bucket_public_access_block.terraform_state` | パブリックアクセス制御 | 4項目すべて`true`(ACL/ポリシーによる公開を全遮断) | state用途は完全に内部専用で外部公開の必要が一切ないため、誤公開による機密情報漏洩リスクを排除 | `main.tf` |
| `aws_s3_bucket_policy.terraform_state`<br>(`data.aws_iam_policy_document.terraform_state`) | バケットポリシー | `aws:SecureTransport = false`の場合に`s3:*`を`Deny` | HTTP(非暗号化通信)でのアクセスを拒否し、通信経路上の盗聴・改ざんリスクを防止 | `main.tf` |

## 出力値

| 出力名 | 内容 | 定義ファイル |
|---|---|---|
| `state_bucket_name` | 作成したバケット名 | `outputs.tf` |
| `state_bucket_arn` | 作成したバケットのARN | `outputs.tf` |

## ディレクトリ構成

```
infra/bootstrap/
├── versions.tf   # Terraform/プロバイダのバージョン指定、プロバイダ設定(region)
├── main.tf       # S3バケット本体と各種設定(バージョニング/暗号化/公開制御/ポリシー)
├── outputs.tf    # 作成したバケット名/ARNの出力
└── .gitignore    # .terraform/、tfstate、tfvarsを除外(.terraform.lock.hclはコミット対象)
```

## 実行コマンド

```bash
cd infra/bootstrap
AWS_PROFILE=hanasu terraform init
AWS_PROFILE=hanasu terraform plan
AWS_PROFILE=hanasu terraform apply
```
