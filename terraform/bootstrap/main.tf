# ==============================================================================
# BOOTSTRAP: Terraform State Infrastructure
# ==============================================================================
# Run this ONCE before deploying main infrastructure
# This creates the S3 bucket and DynamoDB table for state management
# ==============================================================================

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  # Use local backend for bootstrapping
  # After this runs, you'll switch main infrastructure to S3 backend
  backend "local" {
    path = "bootstrap.tfstate"
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "revivecrm"
}

# Get AWS account ID
data "aws_caller_identity" "current" {}

locals {
  account_id   = data.aws_caller_identity.current.account_id
  state_bucket = "${var.project_name}-terraform-state-${local.account_id}"
  lock_table   = "${var.project_name}-terraform-locks"
}

# ==============================================================================
# S3 BUCKET FOR STATE STORAGE
# ==============================================================================

resource "aws_s3_bucket" "terraform_state" {
  bucket = local.state_bucket

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Name        = "Terraform State Bucket"
    Project     = var.project_name
    ManagedBy   = "Terraform"
    Purpose     = "State Management"
  }
}

# Enable versioning for state recovery
resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Enable encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Block all public access
resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ==============================================================================
# DYNAMODB TABLE FOR STATE LOCKING
# ==============================================================================

resource "aws_dynamodb_table" "terraform_locks" {
  name         = local.lock_table
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Name        = "Terraform State Lock Table"
    Project     = var.project_name
    ManagedBy   = "Terraform"
    Purpose     = "State Locking"
  }
}

# ==============================================================================
# OUTPUTS
# ==============================================================================

output "state_bucket_name" {
  value       = aws_s3_bucket.terraform_state.id
  description = "S3 bucket name for Terraform state"
}

output "state_bucket_arn" {
  value       = aws_s3_bucket.terraform_state.arn
  description = "S3 bucket ARN for Terraform state"
}

output "lock_table_name" {
  value       = aws_dynamodb_table.terraform_locks.id
  description = "DynamoDB table name for state locking"
}

output "lock_table_arn" {
  value       = aws_dynamodb_table.terraform_locks.arn
  description = "DynamoDB table ARN for state locking"
}

output "instructions" {
  value = <<-EOT
  
  ✅ State infrastructure created successfully!
  
  📋 Next steps:
  
  1. Update your main.tf backend configuration:
     
     backend "s3" {
       bucket         = "${local.state_bucket}"
       key            = "production/terraform.tfstate"
       region         = "${var.aws_region}"
       encrypt        = true
       dynamodb_table = "${local.lock_table}"
     }
  
  2. Run this command to update main.tf automatically:
     
     sed -i 's/revivecrm-terraform-state-YOUR-UNIQUE-ID/${local.state_bucket}/g' ../environments/prod/main.tf
  
  3. Initialize with new backend:
     
     cd ../environments/prod
     terraform init -migrate-state
  
  4. Deploy your infrastructure:
     
     terraform apply
  
  🔐 Your Terraform state will now be:
  - ✅ Stored remotely in S3
  - ✅ Locked during operations (prevents duplicates!)
  - ✅ Encrypted at rest
  - ✅ Versioned (can recover old states)
  
  💡 Deploy as many times as you want - no duplicate resources!
  
  EOT
  description = "Next steps for using the state infrastructure"
}
