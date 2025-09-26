resource "aws_cloudwatch_log_group" "webhook_handler_logs" {
  name              = "/aws/lambda/${var.project_name}-webhook-handler"
  retention_in_days = 7
}

# Package Lambda function code
data "archive_file" "lambda_zip" {
  type        = "zip"
  output_path = "${path.module}/lambda_function.zip"
  source_file = "${path.module}/main.py"
  output_file_mode = "0666"
}

# Create Lambda function
resource "aws_lambda_function" "webhook_handler" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "${var.project_name}-webhook-handler"
  role            = aws_iam_role.lambda_role.arn
  handler         = "main.lambda_handler"
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  runtime         = "python3.11"
  timeout         = 30

  environment {
    variables = {
      ENVIRONMENT = var.environment
      PROJECT_NAME = var.project_name
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic_execution,
    aws_cloudwatch_log_group.webhook_handler_logs,
  ]
}
