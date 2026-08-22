# backend/ 用のシークレットを組み立てる。

data "aws_secretsmanager_secret_version" "rds_master" {
  secret_id = aws_db_instance.main.master_user_secret[0].secret_arn
}

locals {
  rds_master_credentials = jsondecode(data.aws_secretsmanager_secret_version.rds_master.secret_string)

  # backend/app/database.py が要求する1本の接続文字列。パスワードに記号が含まれる場合に備えurlencodeする。
  backend_database_url = "postgresql+psycopg://${local.rds_master_credentials.username}:${urlencode(local.rds_master_credentials.password)}@${aws_db_instance.main.address}:${local.db_port}/${var.db_name}"
}

resource "aws_secretsmanager_secret" "backend_database_url" {
  name = "${local.name_prefix}-backend-database-url"
}

resource "aws_secretsmanager_secret_version" "backend_database_url" {
  secret_id     = aws_secretsmanager_secret.backend_database_url.id
  secret_string = local.backend_database_url
}

resource "random_password" "jwt_secret_key" {
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret" "jwt_secret_key" {
  name = "${local.name_prefix}-jwt-secret-key"
}

resource "aws_secretsmanager_secret_version" "jwt_secret_key" {
  secret_id     = aws_secretsmanager_secret.jwt_secret_key.id
  secret_string = random_password.jwt_secret_key.result
}
