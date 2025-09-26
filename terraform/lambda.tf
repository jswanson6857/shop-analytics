# terraform/lambda.tf

# Package Lambda function code
data "archive_file" "lambda_zip" {
  type        = "zip"
  output_path = "${path.module}/lambda_function.zip"
  source_file = "${path.module}/main.py"
  output_file_mode = "0666"
}

# Update existing Lambda function
resource "aws_lambda_function" "webhook_handler" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "${var.project_name}-webhook-handler"
  role            = "arn:aws:iam::095289934716:role/webhook-ingestion-lambda-role"  # Use existing role ARN
  handler         = "main.lambda_handler"
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  runtime         = "python3.11"
  timeout         = 30

  environment {
    variables = {
      ENVIRONMENT          = var.environment
      PROJECT_NAME         = var.project_name
      DYNAMODB_TABLE_NAME  = aws_dynamodb_table.webhook_data_v2.name
    }
  }
}