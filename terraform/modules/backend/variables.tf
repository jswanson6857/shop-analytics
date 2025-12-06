variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment (dev/prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "tekmetric_secret_arn" {
  description = "ARN of Tekmetric credentials secret"
  type        = string
}
