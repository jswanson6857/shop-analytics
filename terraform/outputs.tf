# ==============================================================================
# TERRAFORM OUTPUTS
# ==============================================================================

output "api_gateway_url" {
  value       = aws_api_gateway_deployment.main.invoke_url
  description = "API Gateway base URL"
}

output "api_endpoints" {
  value = {
    ros       = "${aws_api_gateway_deployment.main.invoke_url}/ros"
    contact   = "${aws_api_gateway_deployment.main.invoke_url}/contact"
    users     = "${aws_api_gateway_deployment.main.invoke_url}/users"
    analytics = "${aws_api_gateway_deployment.main.invoke_url}/analytics"
  }
  description = "All API endpoints"
}

output "dynamodb_tables" {
  value = {
    repair_orders    = aws_dynamodb_table.repair_orders.name
    contact_history  = aws_dynamodb_table.contact_history.name
    appointments     = aws_dynamodb_table.appointments.name
    sales_tracking   = aws_dynamodb_table.sales_tracking.name
    settings         = aws_dynamodb_table.settings.name
    analytics_cache  = aws_dynamodb_table.analytics_cache.name
  }
  description = "DynamoDB table names"
}

output "lambda_functions" {
  value = {
    sync_tekmetric     = aws_lambda_function.sync_tekmetric.function_name
    api_ros            = aws_lambda_function.api_ros.function_name
    api_contact        = aws_lambda_function.api_contact.function_name
    api_users          = aws_lambda_function.api_users.function_name
    api_analytics      = aws_lambda_function.api_analytics.function_name
    batch_appointments = aws_lambda_function.batch_appointments.function_name
    batch_sales        = aws_lambda_function.batch_sales.function_name
  }
  description = "Lambda function names"
}

output "eventbridge_schedules" {
  value = {
    sync_tekmetric        = aws_cloudwatch_event_rule.sync_tekmetric_daily.schedule_expression
    verify_appointments   = aws_cloudwatch_event_rule.verify_appointments_hourly.schedule_expression
    track_sales           = aws_cloudwatch_event_rule.track_sales_daily.schedule_expression
  }
  description = "EventBridge schedule expressions"
}

output "deployment_info" {
  value = {
    region      = var.aws_region
    project     = var.project_name
    environment = var.environment
  }
  description = "Deployment information"
}
