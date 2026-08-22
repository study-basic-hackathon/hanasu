terraform {
  required_version = "= 1.15.8"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7"
    }
  }

  backend "s3" {
    # infra/bootstrapで作成したバケット(hanasu-terraform-state-<アカウントID>)と対応。
    # backendブロックは変数を参照できないため、環境ごとの値はここに直接記述する。
    # 926046660554以外のアカウントで動かす場合は、そのアカウントでbootstrapを再実行し値を変更すること。
    bucket       = "hanasu-terraform-state-926046660554"
    key          = "ecs/terraform.tfstate"
    region       = "ap-northeast-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.region
}
