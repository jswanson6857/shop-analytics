# terraform/lambda.tf
# Only update the existing Lambda function

# Package Lambda function code
data "archive_file" "lambda_zip" {
  type        = "zip"
  output_path = "${path.module}/lambda_function.zip"
  source_file = "${path.module}/main.py"
  output_file_mode = "0666"
}

# Update existing Lambda function (don't recreate)
resource "aws_lambda_function" "webhook_handler" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "${var.project_name}-webhook-handler"
  role            = data.aws_iam_role.existing_lambda_role.arn
  handler         = "main.lambda_handler"
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  runtime         = "python3.11"
  timeout         = 30

  environment {
    variables = {
      ENVIRONMENT          = var.environment
      PROJECT_NAME         = var.project_name
      DYNAMODB_TABLE_NAME  = data.aws_dynamodb_table.existing_webhook_data.name
    }
  }
}