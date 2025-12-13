# AWS Provider configuration
provider "aws" {
  region = var.aws_region
  
  # Use explicit credentials if provided (for CI/CD)
  # Otherwise use default credential chain (for local development)
  access_key = var.aws_access_key != "" ? var.aws_access_key : null
  secret_key = var.aws_secret_key != "" ? var.aws_secret_key : null
  
  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
      Repository  = "revivecrm"
    }
  }
}
