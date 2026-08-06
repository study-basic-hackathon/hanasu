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
