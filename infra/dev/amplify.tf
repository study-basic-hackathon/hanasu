resource "aws_amplify_app" "frontend" {
  name        = "${local.name_prefix}-frontend"
  description = "hanasu frontend: Git非接続の手動ZIP配備用"
  platform    = "WEB"

  # Gitリポジトリを接続せず、AWSコンソールから静的ファイルのZIPを手動配備する。
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
