# CloudFront が ALB origin へ到達するために AWS が提供する IP 範囲。
data "aws_ec2_managed_prefix_list" "cloudfront_origin_facing" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

# CORS preflight と認証ヘッダーを含め、閲覧者のリクエストを ALB origin へ渡す。
data "aws_cloudfront_origin_request_policy" "all_viewer_except_host_header" {
  name = "Managed-AllViewerExceptHostHeader"
}

# 値は Terraform state でのみ管理し、コード・tfvars・outputには平文で残さない。
resource "random_password" "cloudfront_origin_header" {
  length  = 48
  special = false
}

resource "aws_cloudfront_distribution" "api" {
  enabled = true
  comment = "${local.name_prefix} API distribution"

  origin {
    domain_name = aws_lb.main.dns_name
    origin_id   = local.cloudfront_origin_id

    custom_header {
      name  = local.cloudfront_origin_header_name
      value = random_password.cloudfront_origin_header.result
    }

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = local.cloudfront_origin_id

    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host_header.id
    viewer_protocol_policy   = "redirect-to-https"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name = "${local.name_prefix}-api"
    Env  = var.env
  }
}
