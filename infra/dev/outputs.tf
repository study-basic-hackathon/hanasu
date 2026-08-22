output "alb_dns_name" {
  description = "ALBのデフォルトドメイン(CloudFront経由のリクエストだけを受け付ける)"
  value       = aws_lb.main.dns_name
}

output "amplify_app_id" {
  description = "手動ZIP配備に使用するAmplify App ID"
  value       = aws_amplify_app.frontend.id
}

output "amplify_app_url" {
  description = "Amplify AppのデフォルトドメインURL"
  value       = "https://${aws_amplify_app.frontend.default_domain}"
}

output "amplify_branch_url" {
  description = "手動ZIP配備後にフロントエンドを公開するAmplify branch URL"
  value       = local.amplify_branch_url
}

output "api_cloudfront_domain_name" {
  description = "フロントエンドに設定するAPI用CloudFrontのHTTPSドメイン名"
  value       = aws_cloudfront_distribution.api.domain_name
}

output "api_cloudfront_url" {
  description = "フロントエンドに設定するAPI用CloudFrontのHTTPS URL"
  value       = "https://${aws_cloudfront_distribution.api.domain_name}"
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
