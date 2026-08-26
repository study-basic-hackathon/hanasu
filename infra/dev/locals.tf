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
    # DATABASE_URLはTerraformで組み立てない(state対策)。backend/app/database.pyが
    # これらとDB_USERNAME/DB_PASSWORD(secrets)から実行時に接続URLを組み立てる。
    { name = "DB_HOST", value = aws_db_instance.main.address },
    { name = "DB_PORT", value = tostring(local.db_port) },
    { name = "DB_NAME", value = var.db_name },
  ]

  container_secrets = [
    { name = "DB_USERNAME", valueFrom = "${aws_db_instance.main.master_user_secret[0].secret_arn}:username::" },
    { name = "DB_PASSWORD", valueFrom = "${aws_db_instance.main.master_user_secret[0].secret_arn}:password::" },
    { name = "JWT_SECRET_KEY", valueFrom = aws_secretsmanager_secret.jwt_secret_key.arn },
    { name = "AMIVOICE_API_KEY", valueFrom = aws_secretsmanager_secret.amivoice_api_key.arn },
  ]
}
