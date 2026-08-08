resource "aws_ecr_repository" "api" {
  name = "${local.name_prefix}-api"
  # :latestタグを都度上書きする運用のため意図的にMUTABLE。
  # ロールバック不可・イメージ改ざんに弱い点は許容(自分のみが触る使い捨てdev環境のため)。
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${local.name_prefix}-api"
  }
}
