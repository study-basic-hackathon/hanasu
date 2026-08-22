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

variable "db_engine_version" {
  type        = string
  description = "RDS(PostgreSQL)のエンジンバージョン"
}

variable "db_instance_class" {
  type        = string
  description = "RDSインスタンスクラス"
}

variable "db_allocated_storage" {
  type        = number
  description = "RDSの割り当てストレージ(GB)"
}

variable "db_name" {
  type        = string
  description = "RDSに作成する初期データベース名"
}

variable "db_username" {
  type        = string
  description = "RDSマスターユーザー名"
}

variable "amplify_branch_name" {
  type        = string
  description = "手動ZIP配備用のAmplify branch名"
}
