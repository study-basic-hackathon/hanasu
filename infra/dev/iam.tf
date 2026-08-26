data "aws_iam_policy_document" "ecs_task_execution_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_task_execution" {
  name               = "${local.name_prefix}-ecs-task-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_execution_assume.json
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ECSタスク起動時にRDSのマスターパスワードやbackend用シークレット(Secrets Manager)を
# 環境変数として注入するために必要
data "aws_iam_policy_document" "ecs_task_execution_secrets" {
  statement {
    effect  = "Allow"
    actions = ["secretsmanager:GetSecretValue"]
    resources = [
      aws_db_instance.main.master_user_secret[0].secret_arn,
      aws_secretsmanager_secret.jwt_secret_key.arn,
      aws_secretsmanager_secret.amivoice_api_key.arn,
    ]
  }
}

resource "aws_iam_role_policy" "ecs_task_execution_secrets" {
  name   = "${local.name_prefix}-ecs-task-execution-secrets"
  role   = aws_iam_role.ecs_task_execution.id
  policy = data.aws_iam_policy_document.ecs_task_execution_secrets.json
}

# アプリ(コンテナ内プロセス)がBedrock等のAWS APIを呼ぶためのロール。ECR pull用の実行ロールとは権限の対象が異なるため分離する
resource "aws_iam_role" "ecs_task" {
  name               = "${local.name_prefix}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_execution_assume.json
}

# クロスリージョン推論プロファイルの呼び出しは、プロファイル自体に加え、
# ルーティング先になる各リージョンのfoundation-modelへの許可も必要になる
data "aws_bedrock_inference_profile" "bedrock" {
  inference_profile_id = var.bedrock_model_id
}

data "aws_iam_policy_document" "ecs_task_bedrock" {
  statement {
    effect = "Allow"
    actions = [
      "bedrock:InvokeModel",
      "bedrock:InvokeModelWithResponseStream",
    ]
    resources = concat(
      [data.aws_bedrock_inference_profile.bedrock.inference_profile_arn],
      [for m in data.aws_bedrock_inference_profile.bedrock.models : m.model_arn],
    )
  }

  # anthropic SDKのAnthropicBedrockはbedrock-runtimeのホスト名を叩くが、
  # このモデルの実行認可は内部的にbedrock-mantle側でも評価される(実機検証で確認済み)ため、
  # 両方の権限が無いとPermissionDeniedになる。
  statement {
    effect = "Allow"
    actions = [
      "bedrock-mantle:CreateInference",
      "bedrock-mantle:GetProject",
      "bedrock-mantle:ListProjects",
      "bedrock-mantle:ListTagsForResources",
    ]
    resources = ["arn:aws:bedrock-mantle:${var.region}:${data.aws_caller_identity.current.account_id}:project/*"]
  }
}

resource "aws_iam_role_policy" "ecs_task_bedrock" {
  name   = "${local.name_prefix}-ecs-task-bedrock"
  role   = aws_iam_role.ecs_task.id
  policy = data.aws_iam_policy_document.ecs_task_bedrock.json
}
