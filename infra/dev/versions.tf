terraform {
  required_version = "= 1.15.8"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  backend "s3" {
    # infra/bootstrapで作成したバケット(hanasu-terraform-state-<アカウントID>)と対応。
    # 926046660554以外のアカウントで動かす場合は、そのアカウントでbootstrapを再実行し値を変更すること。
    bucket       = "hanasu-terraform-state-926046660554"
    key          = "ecs/terraform.tfstate"
    region       = "ap-northeast-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = "ap-northeast-1"
}
