# ==============================================================================
# IAM ROLES AND POLICIES FOR LAMBDA FUNCTIONS
# ==============================================================================

# -----------------------------------------------------------------------------
# Lambda Execution Role
# -----------------------------------------------------------------------------
resource "aws_iam_role" "lambda_exec" {
  name = "${var.project_name}-lambda-exec-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

# -----------------------------------------------------------------------------
# Lambda Basic Execution Policy
# -----------------------------------------------------------------------------
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# -----------------------------------------------------------------------------
# DynamoDB Access Policy
# -----------------------------------------------------------------------------
resource "aws_iam_policy" "dynamodb_access" {
  name        = "${var.project_name}-dynamodb-access-v2-${var.environment}"
  description = "Allow Lambda functions to access DynamoDB tables"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem"
        ]
        Resource = [
          aws_dynamodb_table.repair_orders.arn,
          "${aws_dynamodb_table.repair_orders.arn}/index/*",
          aws_dynamodb_table.contact_history.arn,
          "${aws_dynamodb_table.contact_history.arn}/index/*",
          aws_dynamodb_table.appointments.arn,
          "${aws_dynamodb_table.appointments.arn}/index/*",
          aws_dynamodb_table.sales_tracking.arn,
          "${aws_dynamodb_table.sales_tracking.arn}/index/*",
          aws_dynamodb_table.settings.arn,
          "${aws_dynamodb_table.settings.arn}/index/*",
          aws_dynamodb_table.analytics_cache.arn,
          "${aws_dynamodb_table.analytics_cache.arn}/index/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_dynamodb" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.dynamodb_access.arn
}

# -----------------------------------------------------------------------------
# Secrets Manager Access Policy
# -----------------------------------------------------------------------------
resource "aws_iam_policy" "secrets_access" {
  name        = "${var.project_name}-secrets-access-${var.environment}"
  description = "Allow Lambda functions to access Secrets Manager"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = aws_secretsmanager_secret.tekmetric_credentials.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_secrets" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.secrets_access.arn
}

# -----------------------------------------------------------------------------
# EventBridge Execution Role
# -----------------------------------------------------------------------------
resource "aws_iam_role" "eventbridge_exec" {
  name = "${var.project_name}-eventbridge-exec-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "events.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_policy" "eventbridge_invoke_lambda" {
  name        = "${var.project_name}-eventbridge-invoke-lambda-${var.environment}"
  description = "Allow EventBridge to invoke Lambda functions"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = [
          aws_lambda_function.sync_tekmetric.arn,
          aws_lambda_function.batch_appointments.arn,
          aws_lambda_function.batch_sales.arn
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "eventbridge_invoke" {
  role       = aws_iam_role.eventbridge_exec.name
  policy_arn = aws_iam_policy.eventbridge_invoke_lambda.arn
}
