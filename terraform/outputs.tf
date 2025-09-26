output "api_gateway_url" {
  description = "API Gateway base URL"
  value       = "https://${aws_api_gateway_rest_api.webhook_api.id}.execute-api.${var.aws_region}.amazonaws.com/${aws_api_gateway_stage.webhook_api_stage.stage_name}"
}

output "webhook_endpoint" {
  description = "Full webhook endpoint URL"
  value       = "https://${aws_api_gateway_rest_api.webhook_api.id}.execute-api.${var.aws_region}.amazonaws.com/${aws_api_gateway_stage.webhook_api_stage.stage_name}/webhook"
}

output "lambda_function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.webhook_handler.function_name
}

output "dynamodb_table_name" {
  description = "DynamoDB table name"
  value       = aws_dynamodb_table.webhook_data.name
}

output "websocket_api_url" {
  description = "WebSocket API URL"
  value       = aws_apigatewayv2_stage.websocket_stage.invoke_url
}

output "terraform_state_bucket" {
  description = "S3 bucket for Terraform state"
  value       = aws_s3_bucket.terraform_state.bucket
}