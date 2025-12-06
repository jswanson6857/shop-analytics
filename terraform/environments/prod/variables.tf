
# AWS credentials (only for CI/CD - not needed for local with AWS CLI)
variable "aws_access_key" {
  description = "AWS access key (for CI/CD)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "aws_secret_key" {
  description = "AWS secret key (for CI/CD)"
  type        = string
  default     = ""
  sensitive   = true
}
