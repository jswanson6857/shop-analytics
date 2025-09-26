# terraform/dynamodb.tf

# DynamoDB table for webhook data
resource "aws_dynamodb_table" "webhook_data_v2" {
  name           = "${var.project_name}-webhook-data-v2"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"
  range_key      = "timestamp"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  attribute {
    name = "source"
    type = "S"
  }

  global_secondary_index {
    name     = "source-timestamp-index"
    hash_key = "source"
    range_key = "timestamp"
    projection_type = "ALL"
  }

  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "${var.project_name}-webhook-data-v2"
    Environment = var.environment
  }
}

# IAM policy for Lambda to access DynamoDB
resource "aws_iam_policy" "dynamodb_lambda_policy_v2" {
  name        = "${var.project_name}-dynamodb-lambda-policy-v2"
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
          aws_dynamodb_table.webhook_data_v2.arn,
          "${aws_dynamodb_table.webhook_data_v2.arn}/index/*"
        ]
      }
    ]
  })
}

# Attach DynamoDB policy to existing Lambda role (use role name directly)
resource "aws_iam_role_policy_attachment" "lambda_dynamodb_policy_v2" {
  role       = "webhook-ingestion-lambda-role"  # Direct role name
  policy_arn = aws_iam_policy.dynamodb_lambda_policy_v2.arn
}

# Outputs
output "dynamodb_table_name" {
  description = "DynamoDB table name"
  value       = aws_dynamodb_table.webhook_data_v2.name
}

output "dynamodb_table_arn" {
  description = "DynamoDB table ARN"
  value       = aws_dynamodb_table.webhook_data_v2.arn
}

output "dynamodb_stream_arn" {
  description = "DynamoDB stream ARN"
  value       = aws_dynamodb_table.webhook_data_v2.stream_arn
}