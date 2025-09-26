# terraform/websocket.tf
# WebSocket API Gateway for real-time updates

# WebSocket API Gateway
resource "aws_apigatewayv2_api" "websocket_api" {
  name                       = "${var.project_name}-websocket-api"
  protocol_type             = "WEBSOCKET"
  route_selection_expression = "$request.body.action"
  description               = "WebSocket API for real-time webhook data"
}

resource "aws_apigatewayv2_stage" "websocket_stage" {
  api_id      = aws_apigatewayv2_api.websocket_api.id
  name        = var.environment
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = 5000
    throttling_rate_limit  = 2000
  }
}

# WebSocket connection table
resource "aws_dynamodb_table" "websocket_connections" {
  name         = "${var.project_name}-websocket-connections"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "connectionId"

  attribute {
    name = "connectionId"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Environment = var.environment
  }
}

# WebSocket handler Lambda
resource "aws_cloudwatch_log_group" "websocket_handler_logs" {
  name              = "/aws/lambda/${var.project_name}-websocket-handler"
  retention_in_days = 7
}

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

  environment {
    variables = {
      CONNECTION_TABLE_NAME = aws_dynamodb_table.websocket_connections.name
      ENVIRONMENT          = var.environment
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.websocket_handler_logs,
  ]
}

# Broadcast Lambda (triggered by DynamoDB streams)
resource "aws_cloudwatch_log_group" "broadcast_handler_logs" {
  name              = "/aws/lambda/${var.project_name}-broadcast-handler"
  retention_in_days = 7
}

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
  timeout         = 30

  environment {
    variables = {
      WEBSOCKET_API_ENDPOINT = "https://${aws_apigatewayv2_api.websocket_api.id}.execute-api.${var.aws_region}.amazonaws.com/${aws_apigatewayv2_stage.websocket_stage.name}"
      CONNECTION_TABLE_NAME  = aws_dynamodb_table.websocket_connections.name
      ENVIRONMENT           = var.environment
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.broadcast_handler_logs,
  ]
}

# WebSocket routes
resource "aws_apigatewayv2_route" "connect_route" {
  api_id    = aws_apigatewayv2_api.websocket_api.id
  route_key = "$connect"
  target    = "integrations/${aws_apigatewayv2_integration.connect_integration.id}"
}

resource "aws_apigatewayv2_route" "disconnect_route" {
  api_id    = aws_apigatewayv2_api.websocket_api.id
  route_key = "$disconnect"
  target    = "integrations/${aws_apigatewayv2_integration.disconnect_integration.id}"
}

# WebSocket integrations
resource "aws_apigatewayv2_integration" "connect_integration" {
  api_id           = aws_apigatewayv2_api.websocket_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.websocket_handler.invoke_arn
}

resource "aws_apigatewayv2_integration" "disconnect_integration" {
  api_id           = aws_apigatewayv2_api.websocket_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.websocket_handler.invoke_arn
}

# Lambda permissions
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
}