# ==============================================================================
# REVIVECRM PRODUCTION ENVIRONMENT
# ==============================================================================

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
  
  # =============================================================================
  # S3 Backend with DynamoDB Locking (PREVENTS DUPLICATE RESOURCES)
  # =============================================================================
  backend "s3" {
    bucket         = "revivecrm-terraform-state-YOUR-UNIQUE-ID"  # CHANGE THIS!
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "revivecrm-terraform-locks"
  }
  
  # Alternative: Terraform Cloud (also prevents duplicates)
  # backend "remote" {
  #   organization = "YOUR-ORG-NAME"
  #   workspaces {
  #     name = "revivecrm-production"
  #   }
  # }
}

# Provider is in provider.tf

# ==============================================================================
# LOCAL VARIABLES
# ==============================================================================

resource "random_id" "suffix" {
  byte_length = 4
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"
  common_tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
    Application = "ReviveCRM"
  }
}

# ==============================================================================
# SECRETS MANAGER
# ==============================================================================

resource "aws_secretsmanager_secret" "tekmetric_credentials" {
  name        = "${local.name_prefix}-tekmetric-credentials"
  description = "Tekmetric API credentials"

  recovery_window_in_days = 7
  
  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "tekmetric_credentials" {
  secret_id = aws_secretsmanager_secret.tekmetric_credentials.id

  secret_string = jsonencode({
    client_id     = var.tekmetric_client_id
    client_secret = var.tekmetric_client_secret
    shop_id       = var.tekmetric_shop_id
    api_url       = "https://shop.tekmetric.com/api/v1"
  })
}

# ==============================================================================
# BACKEND MODULE (DynamoDB, Lambda, API Gateway, EventBridge)
# ==============================================================================

module "backend" {
  source = "../../modules/backend"

  project_name         = var.project_name
  environment          = var.environment
  aws_region           = var.aws_region
  tekmetric_secret_arn = aws_secretsmanager_secret.tekmetric_credentials.arn
}

# ==============================================================================
# FRONTEND MODULE (S3 + CloudFront)
# ==============================================================================

module "frontend" {
  source = "../../modules/frontend"

  project_name = var.project_name
  environment  = var.environment
}

# ==============================================================================
# OUTPUTS
# ==============================================================================

output "api_gateway_url" {
  value       = module.backend.api_gateway_url
  description = "API Gateway base URL"
}

output "s3_bucket_name" {
  value       = module.frontend.s3_bucket_name
  description = "Frontend S3 bucket name"
}

output "cloudfront_distribution_id" {
  value       = module.frontend.cloudfront_distribution_id
  description = "CloudFront distribution ID"
}

output "cloudfront_url" {
  value       = module.frontend.cloudfront_url
  description = "Full CloudFront URL for frontend"
}

output "lambda_functions" {
  value       = module.backend.lambda_functions
  description = "Lambda function names"
}

output "dynamodb_tables" {
  value       = module.backend.dynamodb_tables
  description = "DynamoDB table names"
}
