# terraform/websocket.tf

# WebSocket API Gateway
resource "aws_apigatewayv2_api" "websocket_api" {
  name                       = "${var.project_name}-websocket-api"
  protocol_type             = "WEBSOCKET"
  route_selection_expression = "$request.body.action"
  description               = "WebSocket API for real-time webhook data"

  tags = {
    Name = "${var.project_name}-websocket-api"
    Environment = var.environment
  }
}

# WebSocket API Stage
resource "aws_apigatewayv2_stage" "websocket_stage" {
  api_id      = aws_apigatewayv2_api.websocket_api.id
  name        = var.environment
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = 5000
    throttling_rate_limit  = 2000
  }
}

# Lambda function for WebSocket connection management
resource "aws_lambda_function" "websocket_handler" {
  filename         = data.archive_file.websocket_lambda_zip.output_path
  function_name    = "${var.project_name}-websocket-handler"
  role            = aws_iam_role.websocket_lambda_role.arn
  handler         = "websocket_handler.lambda_handler"
  source_code_hash = data.archive_file.websocket_lambda_zip.output_base64sha256
  runtime         = "python3.11"
  timeout         = 30

  environment {
    variables = {
      WEBSOCKET_API_ENDPOINT = aws_apigatewayv2_stage.websocket_stage.invoke_url
      DYNAMODB_TABLE_NAME    = aws_dynamodb_table.webhook_data.name
      ENVIRONMENT           = var.environment
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.websocket_lambda_basic_execution,
    aws_cloudwatch_log_group.websocket_handler_logs,
  ]
}

# Package WebSocket Lambda function code
data "archive_file" "websocket_lambda_zip" {
  type        = "zip"
  output_path = "${path.module}/websocket_lambda.zip"
  source_file = "${path.module}/websocket_handler.py"
  output_file_mode = "0666"
}

# CloudWatch Log Group for WebSocket Lambda
resource "aws_cloudwatch_log_group" "websocket_handler_logs" {
  name              = "/aws/lambda/${var.project_name}-websocket-handler"
  retention_in_days = 7
}

# IAM role for WebSocket Lambda
resource "aws_iam_role" "websocket_lambda_role" {
  name = "${var.project_name}-websocket-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# Attach basic execution policy to WebSocket Lambda role
resource "aws_iam_role_policy_attachment" "websocket_lambda_basic_execution" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  role       = aws_iam_role.websocket_lambda_role.name
}

# IAM policy for WebSocket Lambda to manage API Gateway connections
resource "aws_iam_policy" "websocket_lambda_policy" {
  name        = "${var.project_name}-websocket-lambda-policy"
  description = "IAM policy for WebSocket Lambda to manage connections"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "execute-api:ManageConnections"
        ]
        Resource = "${aws_apigatewayv2_api.websocket_api.execution_arn}/*/*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:DescribeStream",
          "dynamodb:GetRecords",
          "dynamodb:GetShardIterator",
          "dynamodb:ListStreams"
        ]
        Resource = aws_dynamodb_table.webhook_data.stream_arn
      }
    ]
  })
}

# Attach WebSocket policy to Lambda role
resource "aws_iam_role_policy_attachment" "websocket_lambda_policy" {
  role       = aws_iam_role.websocket_lambda_role.name
  policy_arn = aws_iam_policy.websocket_lambda_policy.arn
}

# WebSocket Routes
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

# WebSocket Integrations
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

# Lambda permissions for WebSocket API
resource "aws_lambda_permission" "websocket_api_lambda_connect" {
  statement_id  = "AllowExecutionFromWebSocketAPIConnect"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.websocket_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket_api.execution_arn}/*/*"
}

# DynamoDB Stream Event Source Mapping
resource "aws_lambda_event_source_mapping" "dynamodb_stream" {
  event_source_arn  = aws_dynamodb_table.webhook_data.stream_arn
  function_name     = aws_lambda_function.websocket_broadcast.arn
  starting_position = "LATEST"
  batch_size        = 10
}

# Broadcast Lambda (triggered by DynamoDB Streams)
resource "aws_lambda_function" "websocket_broadcast" {
  filename         = data.archive_file.broadcast_lambda_zip.output_path
  function_name    = "${var.project_name}-websocket-broadcast"
  role            = aws_iam_role.websocket_lambda_role.arn
  handler         = "broadcast_handler.lambda_handler"
  source_code_hash = data.archive_file.broadcast_lambda_zip.output_base64sha256
  runtime         = "python3.11"
  timeout         = 30

  environment {
    variables = {
      WEBSOCKET_API_ENDPOINT = aws_apigatewayv2_stage.websocket_stage.invoke_url
      CONNECTION_TABLE_NAME  = aws_dynamodb_table.websocket_connections.name
      ENVIRONMENT           = var.environment
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.websocket_lambda_basic_execution,
    aws_cloudwatch_log_group.broadcast_handler_logs,
  ]
}

# Package Broadcast Lambda function code
data "archive_file" "broadcast_lambda_zip" {
  type        = "zip"
  output_path = "${path.module}/broadcast_lambda.zip"
  source_file = "${path.module}/broadcast_handler.py"
  output_file_mode = "0666"
}

# CloudWatch Log Group for Broadcast Lambda
resource "aws_cloudwatch_log_group" "broadcast_handler_logs" {
  name              = "/aws/lambda/${var.project_name}-websocket-broadcast"
  retention_in_days = 7
}

# DynamoDB table for WebSocket connections
resource "aws_dynamodb_table" "websocket_connections" {
  name         = "${var.project_name}-websocket-connections"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "connectionId"

  attribute {
    name = "connectionId"
    type = "S"
  }

  # TTL for automatic cleanup of stale connections
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Name = "${var.project_name}-websocket-connections"
    Environment = var.environment
  }
}

# IAM policy for connection table access
resource "aws_iam_policy" "websocket_connections_policy" {
  name        = "${var.project_name}-websocket-connections-policy"
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
        Resource = aws_dynamodb_table.websocket_connections.arn
      }
    ]
  })
}

# Attach connections policy to WebSocket Lambda role
resource "aws_iam_role_policy_attachment" "websocket_connections_policy" {
  role       = aws_iam_role.websocket_lambda_role.name
  policy_arn = aws_iam_policy.websocket_connections_policy.arn
}

# Outputs
output "websocket_api_url" {
  description = "WebSocket API URL"
  value       = aws_apigatewayv2_stage.websocket_stage.invoke_url
}

output "websocket_api_id" {
  description = "WebSocket API ID"
  value       = aws_apigatewayv2_api.websocket_api.id
}