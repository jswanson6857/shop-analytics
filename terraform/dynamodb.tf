# terraform/dynamodb.tf

# DynamoDB table for webhook data
resource "aws_dynamodb_table" "webhook_data" {
  name           = "${var.project_name}-webhook-data"
  billing_mode   = "PAY_PER_REQUEST"  # Cost-effective for variable loads
  hash_key       = "id"
  range_key      = "timestamp"

  # Primary key
  attribute {
    name = "id"
    type = "S"
  }

  # Sort key (timestamp)
  attribute {
    name = "timestamp"
    type = "S"
  }

  # GSI for querying by webhook source
  attribute {
    name = "source"
    type = "S"
  }

  # Global Secondary Index for querying by source
  global_secondary_index {
    name     = "source-timestamp-index"
    hash_key = "source"
    range_key = "timestamp"
    projection_type = "ALL"
  }

  # Enable DynamoDB Streams for real-time processing
  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  # TTL for automatic data cleanup (optional)
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  # Point-in-time recovery
  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "${var.project_name}-webhook-data"
    Environment = var.environment
  }
}

# IAM policy for Lambda to access DynamoDB
resource "aws_iam_policy" "dynamodb_lambda_policy" {
  name        = "${var.project_name}-dynamodb-lambda-policy"
  description = "IAM policy for Lambda to access DynamoDB"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.webhook_data.arn,
          "${aws_dynamodb_table.webhook_data.arn}/index/*"
        ]
      }
    ]
  })
}

# Attach DynamoDB policy to existing Lambda role
resource "aws_iam_role_policy_attachment" "lambda_dynamodb_policy" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.dynamodb_lambda_policy.arn
}

# Output DynamoDB table info
output "dynamodb_table_name" {
  description = "DynamoDB table name"
  value       = aws_dynamodb_table.webhook_data.name
}

output "dynamodb_table_arn" {
  description = "DynamoDB table ARN"
  value       = aws_dynamodb_table.webhook_data.arn
}

output "dynamodb_stream_arn" {
  description = "DynamoDB stream ARN"
  value       = aws_dynamodb_table.webhook_data.stream_arn
}