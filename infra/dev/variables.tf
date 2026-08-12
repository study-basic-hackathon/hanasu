variable "env" {
  type        = string
  description = "環境名(dev / prod)"
}

variable "project_name" {
  type        = string
  description = "プロジェクト名(リソース命名のプレフィックスに使用)"
}

variable "region" {
  type        = string
  description = "リソースを作成するAWSリージョン"
}

variable "vpc_cidr" {
  type        = string
  description = "VPCのCIDRブロック"
}

variable "health_check_path" {
  type        = string
  description = "ALBターゲットグループのヘルスチェックパス"
}
