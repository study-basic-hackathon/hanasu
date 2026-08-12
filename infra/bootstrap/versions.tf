# このディレクトリはTerraform state保存用バケットそのものを作るため、
# 循環を避けてbackendブロックを指定せずlocal stateのまま運用する。
terraform {
  required_version = "= 1.15.8"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = "ap-northeast-1"
}
