locals {
  name_prefix     = "hanasu"
  container_port  = 8000
  container_image = "${aws_ecr_repository.api.repository_url}:latest"
}
