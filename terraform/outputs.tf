output "api_gateway_url" {
  description = "API Gateway base URL"
  value       = aws_api_gateway_deployment.webhook_api_deployment.invoke_url
}

output "webhook_endpoint" {
  description = "Full webhook endpoint URL"
  value       = "${aws_api_gateway_deployment.webhook_api_deployment.invoke_url}/webhook"
}

output "lambda_function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.webhook_handler.function_name
}
