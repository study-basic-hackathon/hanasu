# backend/ 用のシークレットを組み立てる。
#
# RDSのマスターパスワードはTerraformで読み取って別の文字列(接続URL)に組み立てない。
# 組み立てた値はsensitive指定してもstateには平文で残るため、ARNだけをECSに渡し、
# 接続URLの組み立ては実行時にbackend/app/database.py側で行う(DB_HOST/DB_PORT/DB_NAME
# は環境変数、DB_USERNAME/DB_PASSWORDはECSのsecretsでRDSマスターシークレットから直接注入)。

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
