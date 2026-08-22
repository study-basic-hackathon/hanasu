locals {
  name_prefix     = "${var.project_name}-${var.env}"
  container_port  = 8000
  container_image = "${aws_ecr_repository.api.repository_url}:latest"
  db_port         = 5432

  health_check_path = "/health"

  amplify_branch_url            = "https://${aws_amplify_branch.frontend.branch_name}.${aws_amplify_app.frontend.default_domain}"
  cloudfront_origin_id          = "${local.name_prefix}-api-alb"
  cloudfront_origin_header_name = "X-Origin-Verify"

  container_environment = [
    { name = "AWS_REGION", value = var.region },
    { name = "BEDROCK_MODEL_ID", value = var.bedrock_model_id },
    { name = "CORS_ALLOWED_ORIGINS", value = local.amplify_branch_url },
    # ADR-0011: 会員登録なしの固定ユーザーをbackend起動時に投入する(testuser/testpass)
    { name = "SEED_DEV_USER", value = "true" },
  ]

  container_secrets = [
    { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.backend_database_url.arn },
    { name = "JWT_SECRET_KEY", valueFrom = aws_secretsmanager_secret.jwt_secret_key.arn },
  ]
}
