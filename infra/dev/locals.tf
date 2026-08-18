locals {
  name_prefix     = "${var.project_name}-${var.env}"
  container_port  = 8000
  container_image = "${aws_ecr_repository.api.repository_url}:latest"
  db_port         = 5432
}
