env          = "dev"
project_name = "hanasu"
region       = "ap-northeast-1"
vpc_cidr     = "10.0.0.0/16"

db_engine_version    = "16"
db_instance_class    = "db.t4g.micro"
db_allocated_storage = 20
db_name              = "hanasu"
db_username          = "hanasu_admin"

bedrock_model_id = "jp.anthropic.claude-sonnet-4-6"

amplify_branch_name = "main"
github_repository   = "study-basic-hackathon@212195036/hanasu@1319873544"
