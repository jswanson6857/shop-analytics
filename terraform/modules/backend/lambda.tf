# ==============================================================================
# LAMBDA FUNCTIONS
# ==============================================================================

# Package Lambda functions
data "archive_file" "sync_tekmetric" {
  type        = "zip"
  source_dir  = "${path.module}/../lambdas/sync-tekmetric"
  output_path = "${path.module}/.terraform/lambda-packages/sync-tekmetric.zip"
}

data "archive_file" "api_ros" {
  type        = "zip"
  source_dir  = "${path.module}/../lambdas/api-ros"
  output_path = "${path.module}/.terraform/lambda-packages/api-ros.zip"
}

data "archive_file" "api_contact" {
  type        = "zip"
  source_dir  = "${path.module}/../lambdas/api-contact"
  output_path = "${path.module}/.terraform/lambda-packages/api-contact.zip"
}

data "archive_file" "api_users" {
  type        = "zip"
  source_dir  = "${path.module}/../lambdas/api-users"
  output_path = "${path.module}/.terraform/lambda-packages/api-users.zip"
}

data "archive_file" "api_analytics" {
  type        = "zip"
  source_dir  = "${path.module}/../lambdas/api-analytics"
  output_path = "${path.module}/.terraform/lambda-packages/api-analytics.zip"
}

data "archive_file" "batch_appointments" {
  type        = "zip"
  source_dir  = "${path.module}/../lambdas/batch-appointments"
  output_path = "${path.module}/.terraform/lambda-packages/batch-appointments.zip"
}

data "archive_file" "batch_sales" {
  type        = "zip"
  source_dir  = "${path.module}/../lambdas/batch-sales"
  output_path = "${path.module}/.terraform/lambda-packages/batch-sales.zip"
}

# -----------------------------------------------------------------------------
# LAMBDA: sync-tekmetric
# -----------------------------------------------------------------------------
resource "aws_lambda_function" "sync_tekmetric" {
  filename         = data.archive_file.sync_tekmetric.output_path
  function_name    = "${var.project_name}-sync-tekmetric-${var.environment}"
  role            = aws_iam_role.lambda_exec.arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.sync_tekmetric.output_base64sha256
  runtime         = "nodejs18.x"
  timeout         = 900 # 15 minutes
  memory_size     = 512
  
  environment {
    variables = {
      REPAIR_ORDERS_TABLE = aws_dynamodb_table.repair_orders.name
      TEKMETRIC_SECRET_ARN = aws_secretsmanager_secret.tekmetric_credentials.arn
      AWS_REGION = var.aws_region
    }
  }
}

resource "aws_cloudwatch_log_group" "sync_tekmetric" {
  name              = "/aws/lambda/${aws_lambda_function.sync_tekmetric.function_name}"
  retention_in_days = 14
}

# -----------------------------------------------------------------------------
# LAMBDA: api-ros
# -----------------------------------------------------------------------------
resource "aws_lambda_function" "api_ros" {
  filename         = data.archive_file.api_ros.output_path
  function_name    = "${var.project_name}-api-ros-${var.environment}"
  role            = aws_iam_role.lambda_exec.arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.api_ros.output_base64sha256
  runtime         = "nodejs18.x"
  timeout         = 30
  memory_size     = 256
  
  environment {
    variables = {
      REPAIR_ORDERS_TABLE = aws_dynamodb_table.repair_orders.name
      AWS_REGION = var.aws_region
    }
  }
}

resource "aws_cloudwatch_log_group" "api_ros" {
  name              = "/aws/lambda/${aws_lambda_function.api_ros.function_name}"
  retention_in_days = 14
}

# -----------------------------------------------------------------------------
# LAMBDA: api-contact
# -----------------------------------------------------------------------------
resource "aws_lambda_function" "api_contact" {
  filename         = data.archive_file.api_contact.output_path
  function_name    = "${var.project_name}-api-contact-${var.environment}"
  role            = aws_iam_role.lambda_exec.arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.api_contact.output_base64sha256
  runtime         = "nodejs18.x"
  timeout         = 30
  memory_size     = 256
  
  environment {
    variables = {
      REPAIR_ORDERS_TABLE = aws_dynamodb_table.repair_orders.name
      CONTACT_HISTORY_TABLE = aws_dynamodb_table.contact_history.name
      APPOINTMENTS_TABLE = aws_dynamodb_table.appointments.name
      AWS_REGION = var.aws_region
    }
  }
}

resource "aws_cloudwatch_log_group" "api_contact" {
  name              = "/aws/lambda/${aws_lambda_function.api_contact.function_name}"
  retention_in_days = 14
}

# -----------------------------------------------------------------------------
# LAMBDA: api-users
# -----------------------------------------------------------------------------
resource "aws_lambda_function" "api_users" {
  filename         = data.archive_file.api_users.output_path
  function_name    = "${var.project_name}-api-users-${var.environment}"
  role            = aws_iam_role.lambda_exec.arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.api_users.output_base64sha256
  runtime         = "nodejs18.x"
  timeout         = 30
  memory_size     = 256
  
  environment {
    variables = {
      TEKMETRIC_SECRET_ARN = aws_secretsmanager_secret.tekmetric_credentials.arn
      AWS_REGION = var.aws_region
    }
  }
}

resource "aws_cloudwatch_log_group" "api_users" {
  name              = "/aws/lambda/${aws_lambda_function.api_users.function_name}"
  retention_in_days = 14
}

# -----------------------------------------------------------------------------
# LAMBDA: api-analytics
# -----------------------------------------------------------------------------
resource "aws_lambda_function" "api_analytics" {
  filename         = data.archive_file.api_analytics.output_path
  function_name    = "${var.project_name}-api-analytics-${var.environment}"
  role            = aws_iam_role.lambda_exec.arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.api_analytics.output_base64sha256
  runtime         = "nodejs18.x"
  timeout         = 60
  memory_size     = 512
  
  environment {
    variables = {
      REPAIR_ORDERS_TABLE = aws_dynamodb_table.repair_orders.name
      CONTACT_HISTORY_TABLE = aws_dynamodb_table.contact_history.name
      SALES_TRACKING_TABLE = aws_dynamodb_table.sales_tracking.name
      AWS_REGION = var.aws_region
    }
  }
}

resource "aws_cloudwatch_log_group" "api_analytics" {
  name              = "/aws/lambda/${aws_lambda_function.api_analytics.function_name}"
  retention_in_days = 14
}

# -----------------------------------------------------------------------------
# LAMBDA: batch-appointments
# -----------------------------------------------------------------------------
resource "aws_lambda_function" "batch_appointments" {
  filename         = data.archive_file.batch_appointments.output_path
  function_name    = "${var.project_name}-batch-appointments-${var.environment}"
  role            = aws_iam_role.lambda_exec.arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.batch_appointments.output_base64sha256
  runtime         = "nodejs18.x"
  timeout         = 900
  memory_size     = 512
  
  environment {
    variables = {
      REPAIR_ORDERS_TABLE = aws_dynamodb_table.repair_orders.name
      APPOINTMENTS_TABLE = aws_dynamodb_table.appointments.name
      TEKMETRIC_SECRET_ARN = aws_secretsmanager_secret.tekmetric_credentials.arn
      AWS_REGION = var.aws_region
    }
  }
}

resource "aws_cloudwatch_log_group" "batch_appointments" {
  name              = "/aws/lambda/${aws_lambda_function.batch_appointments.function_name}"
  retention_in_days = 14
}

# -----------------------------------------------------------------------------
# LAMBDA: batch-sales
# -----------------------------------------------------------------------------
resource "aws_lambda_function" "batch_sales" {
  filename         = data.archive_file.batch_sales.output_path
  function_name    = "${var.project_name}-batch-sales-${var.environment}"
  role            = aws_iam_role.lambda_exec.arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.batch_sales.output_base64sha256
  runtime         = "nodejs18.x"
  timeout         = 900
  memory_size     = 512
  
  environment {
    variables = {
      REPAIR_ORDERS_TABLE = aws_dynamodb_table.repair_orders.name
      SALES_TRACKING_TABLE = aws_dynamodb_table.sales_tracking.name
      TEKMETRIC_SECRET_ARN = aws_secretsmanager_secret.tekmetric_credentials.arn
      AWS_REGION = var.aws_region
    }
  }
}

resource "aws_cloudwatch_log_group" "batch_sales" {
  name              = "/aws/lambda/${aws_lambda_function.batch_sales.function_name}"
  retention_in_days = 14
}

# -----------------------------------------------------------------------------
# OUTPUTS
# -----------------------------------------------------------------------------
output "lambda_functions" {
  value = {
    sync_tekmetric      = aws_lambda_function.sync_tekmetric.function_name
    api_ros             = aws_lambda_function.api_ros.function_name
    api_contact         = aws_lambda_function.api_contact.function_name
    api_users           = aws_lambda_function.api_users.function_name
    api_analytics       = aws_lambda_function.api_analytics.function_name
    batch_appointments  = aws_lambda_function.batch_appointments.function_name
    batch_sales         = aws_lambda_function.batch_sales.function_name
  }
}
