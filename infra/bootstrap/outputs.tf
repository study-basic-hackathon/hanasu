output "state_bucket_name" {
  description = "Terraform stateを保存するS3バケット名"
  value       = aws_s3_bucket.terraform_state.bucket
}

output "state_bucket_arn" {
  description = "Terraform stateを保存するS3バケットのARN"
  value       = aws_s3_bucket.terraform_state.arn
}
