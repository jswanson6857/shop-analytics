# terraform/existing-resources.tf
# Reference existing AWS resources without managing them

# Reference existing Lambda role
data "aws_iam_role" "existing_lambda_role" {
  name = "webhook-ingestion-lambda-role"
}

# Reference existing DynamoDB table (if it exists)
data "aws_dynamodb_table" "existing_webhook_data" {
  name = "webhook-ingestion-webhook-data"
}

# Create policy to access existing DynamoDB table
resource "aws_iam_policy" "existing_table_access" {
  name        = "${var.project_name}-existing-table-access"
  description = "Access to existing DynamoDB table"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = data.aws_dynamodb_table.existing_webhook_data.arn
      }
    ]
  })
}

# Attach policy to existing role
resource "aws_iam_role_policy_attachment" "existing_table_access" {
  role       = data.aws_iam_role.existing_lambda_role.name
  policy_arn = aws_iam_policy.existing_table_access.arn
}