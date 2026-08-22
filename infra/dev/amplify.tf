resource "aws_amplify_app" "frontend" {
  name        = "${local.name_prefix}-frontend"
  description = "hanasu frontend: Git非接続のGitHub Actions直接配備用"
  platform    = "WEB"

  # Gitリポジトリを接続せず、GitHub Actionsから静的ファイルのZIPを直接配備する。
  enable_branch_auto_build = false

  tags = {
    Name = "${local.name_prefix}-frontend"
    Env  = var.env
  }
}

resource "aws_amplify_branch" "frontend" {
  app_id      = aws_amplify_app.frontend.id
  branch_name = var.amplify_branch_name
  stage       = "PRODUCTION"

  enable_auto_build = false
}
