resource "aws_dynamodb_table" "webhook_data" {
  name           = "${var.project_name}-webhook-data"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"
  range_key      = "timestamp"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  attribute {
    name = "source"
    type = "S"
  }

  # 🔹 New attribute for the all-timestamp GSI
  attribute {
    name = "pk"
    type = "S"
  }

  # Existing GSI - keep it
  global_secondary_index {
    name               = "source-timestamp-index"
    hash_key           = "source"
    range_key          = "timestamp"
    projection_type    = "ALL"
  }

  # 🔹 New GSI for global time-based queries
  global_secondary_index {
    name               = "all-timestamp-index"
    hash_key           = "pk"
    range_key          = "timestamp"
    projection_type    = "ALL"
  }

  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Environment = var.environment
  }
}
