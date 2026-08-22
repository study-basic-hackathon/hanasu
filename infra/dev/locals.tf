locals {
  name_prefix     = "${var.project_name}-${var.env}"
  container_port  = 8000
  container_image = "${aws_ecr_repository.api.repository_url}:latest"
  db_port         = 5432

  amplify_branch_url            = "https://${aws_amplify_branch.frontend.branch_name}.${aws_amplify_app.frontend.default_domain}"
  cloudfront_origin_id          = "${local.name_prefix}-api-alb"
  cloudfront_origin_header_name = "X-Origin-Verify"
}
