# ==============================================================================
# SECRETS MANAGER - TEKMETRIC API CREDENTIALS
# ==============================================================================

resource "aws_secretsmanager_secret" "tekmetric_credentials" {
  name        = "${var.project_name}-tekmetric-credentials-${var.environment}"
  description = "Tekmetric API credentials"

  recovery_window_in_days = 7
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

output "tekmetric_secret_arn" {
  value       = aws_secretsmanager_secret.tekmetric_credentials.arn
  description = "ARN of Tekmetric credentials secret"
}
