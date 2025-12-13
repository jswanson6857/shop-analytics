# ============================================================================
# IMPORT EXISTING RESOURCES (Terraform 1.5+)
# ============================================================================
# If resources already exist in AWS, this file tells Terraform to adopt them
# instead of trying to create new ones.
#
# USAGE:
# 1. Run: terraform plan -generate-config-out=generated.tf
# 2. Terraform will auto-generate the import blocks
# 3. Run: terraform apply
# 4. Resources are now tracked in state!
#
# OR manually import each one below:

# Import Secrets Manager Secret
import {
  to = aws_secretsmanager_secret.tekmetric_credentials
  id = "revivecrm-prod-tekmetric-credentials"
}

# Import DynamoDB Tables
import {
  to = module.backend.aws_dynamodb_table.repair_orders
  id = "revivecrm-repair-orders-prod"
}

import {
  to = module.backend.aws_dynamodb_table.contact_history
  id = "revivecrm-contact-history-prod"
}

import {
  to = module.backend.aws_dynamodb_table.appointments
  id = "revivecrm-appointments-prod"
}

import {
  to = module.backend.aws_dynamodb_table.sales_tracking
  id = "revivecrm-sales-tracking-prod"
}

import {
  to = module.backend.aws_dynamodb_table.settings
  id = "revivecrm-settings-prod"
}

import {
  to = module.backend.aws_dynamodb_table.analytics_cache
  id = "revivecrm-analytics-cache-prod"
}

# Import IAM Roles
import {
  to = module.backend.aws_iam_role.lambda_exec
  id = "revivecrm-lambda-exec-prod"
}

import {
  to = module.backend.aws_iam_role.eventbridge_exec
  id = "revivecrm-eventbridge-exec-prod"
}

# Import S3 Bucket
import {
  to = module.frontend.aws_s3_bucket.frontend
  id = "revivecrm-frontend-prod"
}

# Import Lambda Functions (if they exist)
import {
  to = module.backend.aws_lambda_function.sync_tekmetric
  id = "revivecrm-sync-tekmetric-prod"
}

import {
  to = module.backend.aws_lambda_function.api_ros
  id = "revivecrm-api-ros-prod"
}

import {
  to = module.backend.aws_lambda_function.api_contact
  id = "revivecrm-api-contact-prod"
}

import {
  to = module.backend.aws_lambda_function.api_users
  id = "revivecrm-api-users-prod"
}

import {
  to = module.backend.aws_lambda_function.api_analytics
  id = "revivecrm-api-analytics-prod"
}

import {
  to = module.backend.aws_lambda_function.batch_appointments
  id = "revivecrm-batch-appointments-prod"
}

import {
  to = module.backend.aws_lambda_function.batch_sales
  id = "revivecrm-batch-sales-prod"
}
