output "alb_dns_name" {
  description = "ALBのデフォルトドメイン(このURLでアクセス可能)"
  value       = aws_lb.main.dns_name
}

output "ecr_repository_url" {
  description = "FastAPIアプリのイメージをpushするECRリポジトリURL"
  value       = aws_ecr_repository.api.repository_url
}

output "ecs_cluster_name" {
  description = "ECSクラスタ名"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECSサービス名"
  value       = aws_ecs_service.api.name
}

output "rds_endpoint" {
  description = "RDSエンドポイント(ホスト:ポート)"
  value       = aws_db_instance.main.endpoint
}

output "rds_master_user_secret_arn" {
  description = "RDSマスターパスワードが保存されているSecrets ManagerのARN"
  value       = aws_db_instance.main.master_user_secret[0].secret_arn
}
