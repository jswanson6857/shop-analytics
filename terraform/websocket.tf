# terraform/websocket.tf - FIXED VERSION
# WebSocket API Gateway for real-time updates

# WebSocket API Gateway
resource "aws_apigatewayv2_api" "websocket_api" {
  name                       = "${var.project_name}-websocket-api"
  protocol_type             = "WEBSOCKET"
  route_selection_expression = "$request.body.action"
  description               = "WebSocket API for real-time webhook data"
  
  cors_configuration {
    allow_credentials = false
    allow_headers     = ["*"]
    allow_methods     = ["*"]
    allow_origins     = ["*"]
    max_age          = 300
  }
}

# WebSocket stage with enhanced configuration
resource "aws_apigatewayv2_stage" "websocket_stage" {
  api_id      = aws_apigatewayv2_api.websocket_api.id
  name        = var.environment
  auto_deploy = true

  # Enhanced route settings for better performance
  default_route_settings {
    throttling_burst_limit   = 5000
    throttling_rate_limit    = 2000
    detailed_metrics_enabled = true
    logging_level           = "ERROR"
  }

  # Access logging configuration
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.websocket_access_logs.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      requestTime    = "$context.requestTime"
      connectionId   = "$context.connectionId"
      routeKey      = "$context.routeKey"
      status        = "$context.status"
      error         = "$context.error.message"
      integration   = "$context.integrationErrorMessage"
      responseLength = "$context.responseLength"
      userAgent     = "$context.identity.userAgent"
      sourceIp      = "$context.identity.sourceIp"
    })
  }

  depends_on = [aws_cloudwatch_log_group.websocket_access_logs]
}

# CloudWatch log groups for debugging
resource "aws_cloudwatch_log_group" "websocket_access_logs" {
  name              = "/aws/apigateway/websocket/${var.project_name}-access-logs"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "websocket_handler_logs" {
  name              = "/aws/lambda/${var.project_name}-websocket-handler"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "broadcast_handler_logs" {
  name              = "/aws/lambda/${var.project_name}-broadcast-handler"
  retention_in_days = 7
}

# WebSocket connection table with proper indexes
resource "aws_dynamodb_table" "websocket_connections" {
  name         = "${var.project_name}-websocket-connections"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "connectionId"

  attribute {
    name = "connectionId"
    type = "S"
  }

  attribute {
    name = "connected"
    type = "S"
  }

  # GSI for querying connected users
  global_secondary_index {
    name     = "connected-index"
    hash_key = "connected"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Environment = var.environment
    Purpose     = "WebSocket connection tracking"
  }
}

# Enhanced WebSocket handler Lambda
data "archive_file" "websocket_lambda_zip" {
  type        = "zip"
  output_path = "${path.module}/websocket_lambda.zip"
  source_file = "${path.module}/websocket_handler.py"
  output_file_mode = "0666"
}

resource "aws_lambda_function" "websocket_handler" {
  filename         = data.archive_file.websocket_lambda_zip.output_path
  function_name    = "${var.project_name}-websocket-handler"
  role            = aws_iam_role.lambda_role.arn
  handler         = "websocket_handler.lambda_handler"
  source_code_hash = data.archive_file.websocket_lambda_zip.output_base64sha256
  runtime         = "python3.11"
  timeout         = 30
  memory_size     = 256

  environment {
    variables = {
      CONNECTION_TABLE_NAME = aws_dynamodb_table.websocket_connections.name
      ENVIRONMENT          = var.environment
      LOG_LEVEL           = "INFO"
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.websocket_handler_logs,
  ]
}

# Enhanced Broadcast Lambda (triggered by DynamoDB streams)
data "archive_file" "broadcast_lambda_zip" {
  type        = "zip"
  output_path = "${path.module}/broadcast_lambda.zip"
  source_file = "${path.module}/broadcast_handler.py"
  output_file_mode = "0666"
}

resource "aws_lambda_function" "broadcast_handler" {
  filename         = data.archive_file.broadcast_lambda_zip.output_path
  function_name    = "${var.project_name}-broadcast-handler"
  role            = aws_iam_role.lambda_role.arn
  handler         = "broadcast_handler.lambda_handler"
  source_code_hash = data.archive_file.broadcast_lambda_zip.output_base64sha256
  runtime         = "python3.11"
  timeout         = 60  # Increased timeout for broadcasting to many connections
  memory_size     = 512  # Increased memory for handling multiple connections

  environment {
    variables = {
      WEBSOCKET_API_ENDPOINT = "https://${aws_apigatewayv2_api.websocket_api.id}.execute-api.${var.aws_region}.amazonaws.com/${aws_apigatewayv2_stage.websocket_stage.name}"
      CONNECTION_TABLE_NAME  = aws_dynamodb_table.websocket_connections.name
      ENVIRONMENT           = var.environment
      LOG_LEVEL            = "INFO"
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.broadcast_handler_logs,
  ]
}

# WebSocket routes with proper error handling
resource "aws_apigatewayv2_route" "connect_route" {
  api_id    = aws_apigatewayv2_api.websocket_api.id
  route_key = "$connect"
  target    = "integrations/${aws_apigatewayv2_integration.connect_integration.id}"
  
  # Optional: Add authorization
  # authorization_type = "AWS_IAM"
}

resource "aws_apigatewayv2_route" "disconnect_route" {
  api_id    = aws_apigatewayv2_api.websocket_api.id
  route_key = "$disconnect"
  target    = "integrations/${aws_apigatewayv2_integration.disconnect_integration.id}"
}

resource "aws_apigatewayv2_route" "default_route" {
  api_id    = aws_apigatewayv2_api.websocket_api.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.default_integration.id}"
}

# WebSocket integrations with proper timeout and error handling
resource "aws_apigatewayv2_integration" "connect_integration" {
  api_id                    = aws_apigatewayv2_api.websocket_api.id
  integration_type          = "AWS_PROXY"
  integration_uri           = aws_lambda_function.websocket_handler.invoke_arn
  integration_method        = "POST"
  content_handling_strategy = "CONVERT_TO_TEXT"
  timeout_milliseconds      = 29000  # Just under the 30-second Lambda timeout
}

resource "aws_apigatewayv2_integration" "disconnect_integration" {
  api_id                    = aws_apigatewayv2_api.websocket_api.id
  integration_type          = "AWS_PROXY"
  integration_uri           = aws_lambda_function.websocket_handler.invoke_arn
  integration_method        = "POST"
  content_handling_strategy = "CONVERT_TO_TEXT"
  timeout_milliseconds      = 29000
}

resource "aws_apigatewayv2_integration" "default_integration" {
  api_id                    = aws_apigatewayv2_api.websocket_api.id
  integration_type          = "AWS_PROXY"
  integration_uri           = aws_lambda_function.websocket_handler.invoke_arn
  integration_method        = "POST"
  content_handling_strategy = "CONVERT_TO_TEXT"
  timeout_milliseconds      = 29000
}

# Lambda permissions for WebSocket API
resource "aws_lambda_permission" "websocket_api_lambda" {
  statement_id  = "AllowExecutionFromWebSocketAPI"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.websocket_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket_api.execution_arn}/*/*"
}

# DynamoDB stream to trigger broadcast
resource "aws_lambda_event_source_mapping" "dynamodb_stream" {
  event_source_arn  = aws_dynamodb_table.webhook_data.stream_arn
  function_name     = aws_lambda_function.broadcast_handler.arn
  starting_position = "LATEST"
  batch_size        = 10
  
  # Enhanced error handling
  maximum_batching_window_in_seconds = 5
  parallelization_factor            = 2
  
  # Dead letter queue for failed events
  function_response_types = ["ReportBatchItemFailures"]
}

# Historical Data Lambda for initial page load
data "archive_file" "historical_data_lambda_zip" {
  type        = "zip"
  output_path = "${path.module}/historical_data_lambda.zip"
  source_file = "${path.module}/historical_data_handler.py"
  output_file_mode = "0666"
}

resource "aws_lambda_function" "historical_data_handler" {
  filename         = data.archive_file.historical_data_lambda_zip.output_path
  function_name    = "${var.project_name}-historical-data-handler"
  role            = aws_iam_role.lambda_role.arn
  handler         = "historical_data_handler.lambda_handler"
  source_code_hash = data.archive_file.historical_data_lambda_zip.output_base64sha256
  runtime         = "python3.11"
  timeout         = 30
  memory_size     = 256

  environment {
    variables = {
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.webhook_data.name
      ENVIRONMENT         = var.environment
      LOG_LEVEL          = "INFO"
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.historical_data_logs,
  ]
}

resource "aws_cloudwatch_log_group" "historical_data_logs" {
  name              = "/aws/lambda/${var.project_name}-historical-data-handler"
  retention_in_days = 7
}

# Add /data endpoint to existing REST API
resource "aws_api_gateway_resource" "data_resource" {
  rest_api_id = aws_api_gateway_rest_api.webhook_api.id
  parent_id   = aws_api_gateway_rest_api.webhook_api.root_resource_id
  path_part   = "data"
}

resource "aws_api_gateway_method" "data_method" {
  rest_api_id   = aws_api_gateway_rest_api.webhook_api.id
  resource_id   = aws_api_gateway_resource.data_resource.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "data_options" {
  rest_api_id   = aws_api_gateway_rest_api.webhook_api.id
  resource_id   = aws_api_gateway_resource.data_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "data_integration" {
  rest_api_id = aws_api_gateway_rest_api.webhook_api.id
  resource_id = aws_api_gateway_resource.data_resource.id
  http_method = aws_api_gateway_method.data_method.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.historical_data_handler.invoke_arn
}

resource "aws_api_gateway_integration" "data_options_integration" {
  rest_api_id = aws_api_gateway_rest_api.webhook_api.id
  resource_id = aws_api_gateway_resource.data_resource.id
  http_method = aws_api_gateway_method.data_options.http_method

  type = "MOCK"
  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_method_response" "data_response" {
  rest_api_id = aws_api_gateway_rest_api.webhook_api.id
  resource_id = aws_api_gateway_resource.data_resource.id
  http_method = aws_api_gateway_method.data_method.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin" = true
  }
}

resource "aws_api_gateway_method_response" "data_options_response" {
  rest_api_id = aws_api_gateway_rest_api.webhook_api.id
  resource_id = aws_api_gateway_resource.data_resource.id
  http_method = aws_api_gateway_method.data_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "data_options_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.webhook_api.id
  resource_id = aws_api_gateway_resource.data_resource.id
  http_method = aws_api_gateway_method.data_options.http_method
  status_code = aws_api_gateway_method_response.data_options_response.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# Outputs for debugging
output "websocket_api_id" {
  description = "WebSocket API ID"
  value       = aws_apigatewayv2_api.websocket_api.id
}

output "websocket_stage_name" {
  description = "WebSocket stage name"
  value       = aws_apigatewayv2_stage.websocket_stage.name
}

output "historical_data_endpoint" {
  description = "Historical data API endpoint"
  value       = "https://${aws_api_gateway_rest_api.webhook_api.id}.execute-api.${var.aws_region}.amazonaws.com/${aws_api_gateway_stage.webhook_api_stage.stage_name}/data"
}

output "websocket_logs" {
  description = "WebSocket CloudWatch log groups"
  value = {
    access_logs     = aws_cloudwatch_log_group.websocket_access_logs.name
    handler_logs    = aws_cloudwatch_log_group.websocket_handler_logs.name
    broadcast_logs  = aws_cloudwatch_log_group.broadcast_handler_logs.name
    historical_logs = aws_cloudwatch_log_group.historical_data_logs.name
  }
}