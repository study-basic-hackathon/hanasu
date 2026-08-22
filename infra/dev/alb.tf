resource "aws_lb" "main" {
  name                       = "${local.name_prefix}-api"
  internal                   = false
  load_balancer_type         = "application"
  security_groups            = [aws_security_group.alb.id]
  subnets                    = aws_subnet.public[*].id
  drop_invalid_header_fields = true

  tags = {
    Name = "${local.name_prefix}-api"
    Env  = var.env
  }
}

resource "aws_lb_target_group" "main" {
  name        = "${local.name_prefix}-api"
  port        = local.container_port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    path                = var.health_check_path
    healthy_threshold   = 2
    unhealthy_threshold = 5
    interval            = 30
    timeout             = 5
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "fixed-response"

    fixed_response {
      content_type = "text/plain"
      message_body = "Forbidden"
      status_code  = "403"
    }
  }

  # CloudFront distribution のデプロイ完了後に直接アクセスを遮断する。
  depends_on = [aws_cloudfront_distribution.api]
}

# CloudFront が付与する秘密 header を持つリクエストだけを API へ転送する。
resource "aws_lb_listener_rule" "cloudfront_origin" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.main.arn
  }

  condition {
    http_header {
      http_header_name = local.cloudfront_origin_header_name
      values           = [random_password.cloudfront_origin_header.result]
    }
  }
}
