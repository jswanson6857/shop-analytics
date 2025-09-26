terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }

  # Optional: Configure remote state backend
  # backend "s3" {
  #   bucket = "your-terraform-state-bucket"
  #   key    = "webhook-ingestion/terraform.tfstate"
  #   region = "us-east-1"
  # }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Environment = var.environment
      Project     = var.project_name
      ManagedBy   = "Terraform"
    }
  }
}

# Variables
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "webhook-ingestion"
}

# Outputs
output "api_gateway_url" {
  description = "API Gateway base URL"
  value       = "https://${aws_api_gateway_rest_api.webhook_api.id}.execute-api.${var.aws_region}.amazonaws.com/${aws_api_gateway_stage.webhook_api_stage.stage_name}"
}

output "webhook_endpoint" {
  description = "Full webhook endpoint URL"
  value       = "https://${aws_api_gateway_rest_api.webhook_api.id}.execute-api.${var.aws_region}.amazonaws.com/${aws_api_gateway_stage.webhook_api_stage.stage_name}/webhook"
}

output "lambda_function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.webhook_handler.function_name
}