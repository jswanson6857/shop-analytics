# terraform/websocket.tf

# WebSocket API Gateway
resource "aws_apigatewayv2_api" "websocket_api_v2" {
  name                       = "${var.project_name}-websocket-api-v2"
  protocol_type             = "WEBSOCKET"
  route_selection_expression = "$request.body.action"
  description               = "WebSocket API for real-time webhook data"

  tags = {
    Name = "${var.project_name}-websocket-api-v2"
    Environment = var.environment
  }
}

# WebSocket API Stage
resource "aws_apigatewayv2_stage" "websocket_stage_v2" {
  api_id      = aws_apigatewayv2_api.websocket_api_v2.id
  name        = var.environment
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = 5000
    throttling_rate_limit  = 2000
  }
}

# Lambda function for WebSocket connection management
resource "aws_lambda_function" "websocket_handler_v2" {
  filename         = data.archive_file.websocket_lambda_zip_v2.output_path
  function_name    = "${var.project_name}-websocket-handler-v2"
  role            = aws_iam_role.lambda_role.arn
  handler         = "websocket_handler.lambda_handler"
  source_code_hash = data.archive_file.websocket_lambda_zip_v2.output_base64sha256
  runtime         = "python3.11"
  timeout         = 30

  environment {
    variables = {
      WEBSOCKET_API_ENDPOINT = aws_apigatewayv2_stage.websocket_stage_v2.invoke_url
      DYNAMODB_TABLE_NAME    = aws_dynamodb_table.webhook_data_v2.name
      ENVIRONMENT           = var.environment
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.websocket_handler_logs_v2,
  ]
}

# Package WebSocket Lambda function code
data "archive_file" "websocket_lambda_zip_v2" {
  type        = "zip"
  output_path = "${path.module}/websocket_lambda_v2.zip"
  source_file = "${path.module}/websocket_handler.py"
  output_file_mode = "0666"
}

# CloudWatch Log Group for WebSocket Lambda
resource "aws_cloudwatch_log_group" "websocket_handler_logs_v2" {
  name              = "/aws/lambda/${var.project_name}-websocket-handler-v2"
  retention_in_days = 7
}

# IAM policy for WebSocket Lambda
resource "aws_iam_policy" "websocket_lambda_policy_v2" {
  name        = "${var.project_name}-websocket-lambda-policy-v2"
  description = "IAM policy for WebSocket Lambda to manage connections"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "execute-api:ManageConnections"
        ]
        Resource = "${aws_apigatewayv2_api.websocket_api_v2.execution_arn}/*/*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:DescribeStream",
          "dynamodb:GetRecords",
          "dynamodb:GetShardIterator",
          "dynamodb:ListStreams"
        ]
        Resource = aws_dynamodb_table.webhook_data_v2.stream_arn
      }
    ]
  })
}

# Attach WebSocket policy to existing Lambda role
resource "aws_iam_role_policy_attachment" "websocket_lambda_policy_v2" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.websocket_lambda_policy_v2.arn
}

# WebSocket Routes
resource "aws_apigatewayv2_route" "connect_route_v2" {
  api_id    = aws_apigatewayv2_api.websocket_api_v2.id
  route_key = "$connect"
  target    = "integrations/${aws_apigatewayv2_integration.connect_integration_v2.id}"
}

resource "aws_apigatewayv2_route" "disconnect_route_v2" {
  api_id    = aws_apigatewayv2_api.websocket_api_v2.id
  route_key = "$disconnect"
  target    = "integrations/${aws_apigatewayv2_integration.disconnect_integration_v2.id}"
}

# WebSocket Integrations
resource "aws_apigatewayv2_integration" "connect_integration_v2" {
  api_id           = aws_apigatewayv2_api.websocket_api_v2.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.websocket_handler_v2.invoke_arn
}

resource "aws_apigatewayv2_integration" "disconnect_integration_v2" {
  api_id           = aws_apigatewayv2_api.websocket_api_v2.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.websocket_handler_v2.invoke_arn
}

# Lambda permissions for WebSocket API
resource "aws_lambda_permission" "websocket_api_lambda_connect_v2" {
  statement_id  = "AllowExecutionFromWebSocketAPIConnect"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.websocket_handler_v2.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket_api_v2.execution_arn}/*/*"
}

# Broadcast Lambda
resource "aws_lambda_function" "websocket_broadcast_v2" {
  filename         = data.archive_file.broadcast_lambda_zip_v2.output_path
  function_name    = "${var.project_name}-websocket-broadcast-v2"
  role            = aws_iam_role.lambda_role.arn
  handler         = "broadcast_handler.lambda_handler"
  source_code_hash = data.archive_file.broadcast_lambda_zip_v2.output_base64sha256
  runtime         = "python3.11"
  timeout         = 30

  environment {
    variables = {
      WEBSOCKET_API_ENDPOINT = aws_apigatewayv2_stage.websocket_stage_v2.invoke_url
      CONNECTION_TABLE_NAME  = aws_dynamodb_table.websocket_connections_v2.name
      ENVIRONMENT           = var.environment
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.broadcast_handler_logs_v2,
  ]
}

# Package Broadcast Lambda function code
data "archive_file" "broadcast_lambda_zip_v2" {
  type        = "zip"
  output_path = "${path.module}/broadcast_lambda_v2.zip"
  source_file = "${path.module}/broadcast_handler.py"
  output_file_mode = "0666"
}

# CloudWatch Log Group for Broadcast Lambda
resource "aws_cloudwatch_log_group" "broadcast_handler_logs_v2" {
  name              = "/aws/lambda/${var.project_name}-websocket-broadcast-v2"
  retention_in_days = 7
}

# DynamoDB Stream Event Source Mapping
resource "aws_lambda_event_source_mapping" "dynamodb_stream_v2" {
  event_source_arn  = aws_dynamodb_table.webhook_data_v2.stream_arn
  function_name     = aws_lambda_function.websocket_broadcast_v2.arn
  starting_position = "LATEST"
  batch_size        = 10
}

# DynamoDB table for WebSocket connections
resource "aws_dynamodb_table" "websocket_connections_v2" {
  name         = "${var.project_name}-websocket-connections-v2"
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
    Name = "${var.project_name}-websocket-connections-v2"
    Environment = var.environment
  }
}

# IAM policy for connection table access
resource "aws_iam_policy" "websocket_connections_policy_v2" {
  name        = "${var.project_name}-websocket-connections-policy-v2"
  description = "IAM policy for WebSocket connections table access"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:DeleteItem",
          "dynamodb:Scan"
        ]
        Resource = aws_dynamodb_table.websocket_connections_v2.arn
      }
    ]
  })
}

# Attach connections policy to existing Lambda role
resource "aws_iam_role_policy_attachment" "websocket_connections_policy_v2" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.websocket_connections_policy_v2.arn
}

# Outputs
output "websocket_api_url" {
  description = "WebSocket API URL"
  value       = aws_apigatewayv2_stage.websocket_stage_v2.invoke_url
}

output "websocket_api_id" {
  description = "WebSocket API ID"
  value       = aws_apigatewayv2_api.websocket_api_v2.id
}