data "aws_caller_identity" "current" {}

resource "aws_iam_openid_connect_provider" "github_actions" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]

  tags = {
    Name = "${local.name_prefix}-github-actions"
    Env  = var.env
  }
}

data "aws_iam_policy_document" "github_actions_amplify_deploy_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github_actions.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # immutableなorganization/repository IDを含むsubjectで、対象リポジトリの対象branchに限定する。
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repository}:ref:refs/heads/${var.amplify_branch_name}"]
    }
  }
}

resource "aws_iam_role" "github_actions_amplify_deploy" {
  name               = "${local.name_prefix}-github-actions-amplify-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_actions_amplify_deploy_assume.json

  tags = {
    Name = "${local.name_prefix}-github-actions-amplify-deploy"
    Env  = var.env
  }
}

data "aws_iam_policy_document" "github_actions_amplify_deploy" {
  statement {
    effect = "Allow"
    actions = [
      "amplify:CreateDeployment",
      "amplify:GetBranch",
      "amplify:StartDeployment",
    ]
    resources = [aws_amplify_branch.frontend.arn]
  }

  statement {
    effect    = "Allow"
    actions   = ["amplify:GetJob"]
    resources = ["${aws_amplify_branch.frontend.arn}/jobs/*"]
  }
}

resource "aws_iam_role_policy" "github_actions_amplify_deploy" {
  name   = "${local.name_prefix}-github-actions-amplify-deploy"
  role   = aws_iam_role.github_actions_amplify_deploy.id
  policy = data.aws_iam_policy_document.github_actions_amplify_deploy.json
}
