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

variable "environment" {
  description = "Environment (production/staging/development)"
  type        = string
  default     = "production"
}

variable "tekmetric_client_id" {
  description = "Tekmetric API client ID"
  type        = string
  sensitive   = true
}

variable "tekmetric_client_secret" {
  description = "Tekmetric API client secret"
  type        = string
  sensitive   = true
}

variable "tekmetric_shop_id" {
  description = "Tekmetric shop ID"
  type        = string
}

variable "auth0_domain" {
  description = "Auth0 domain"
  type        = string
}

variable "auth0_client_id" {
  description = "Auth0 client ID"
  type        = string
}
