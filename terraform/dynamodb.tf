# ==============================================================================
# DYNAMODB TABLES FOR REVIVECRM
# ==============================================================================

# -----------------------------------------------------------------------------
# REPAIR ORDERS TABLE - Main RO data from Tekmetric
# -----------------------------------------------------------------------------
resource "aws_dynamodb_table" "repair_orders" {
  name           = "${var.project_name}-repair-orders-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "ro_id"
  
  attribute {
    name = "ro_id"
    type = "S"
  }
  
  attribute {
    name = "status"
    type = "S"
  }
  
  attribute {
    name = "posted_date"
    type = "S"
  }
  
  attribute {
    name = "follow_up_date"
    type = "S"
  }
  
  # GSI for querying by status
  global_secondary_index {
    name            = "StatusIndex"
    hash_key        = "status"
    range_key       = "posted_date"
    projection_type = "ALL"
  }
  
  # GSI for querying by follow-up date
  global_secondary_index {
    name            = "FollowUpIndex"
    hash_key        = "status"
    range_key       = "follow_up_date"
    projection_type = "ALL"
  }
  
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }
  
  tags = {
    Name        = "${var.project_name}-repair-orders"
    Environment = var.environment
    Project     = var.project_name
  }
}

# -----------------------------------------------------------------------------
# CONTACT HISTORY TABLE - All interactions logged per RO
# -----------------------------------------------------------------------------
resource "aws_dynamodb_table" "contact_history" {
  name           = "${var.project_name}-contact-history-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "ro_id"
  range_key      = "timestamp"
  
  attribute {
    name = "ro_id"
    type = "S"
  }
  
  attribute {
    name = "timestamp"
    type = "S"
  }
  
  attribute {
    name = "user_id"
    type = "S"
  }
  
  # GSI for querying by user
  global_secondary_index {
    name            = "UserIndex"
    hash_key        = "user_id"
    range_key       = "timestamp"
    projection_type = "ALL"
  }
  
  tags = {
    Name        = "${var.project_name}-contact-history"
    Environment = var.environment
    Project     = var.project_name
  }
}

# -----------------------------------------------------------------------------
# APPOINTMENTS TABLE - Scheduled appointments from Tekmetric
# -----------------------------------------------------------------------------
resource "aws_dynamodb_table" "appointments" {
  name           = "${var.project_name}-appointments-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "appointment_id"
  
  attribute {
    name = "appointment_id"
    type = "S"
  }
  
  attribute {
    name = "vehicle_id"
    type = "S"
  }
  
  attribute {
    name = "appointment_date"
    type = "S"
  }
  
  # GSI for querying by vehicle
  global_secondary_index {
    name            = "VehicleIndex"
    hash_key        = "vehicle_id"
    range_key       = "appointment_date"
    projection_type = "ALL"
  }
  
  tags = {
    Name        = "${var.project_name}-appointments"
    Environment = var.environment
    Project     = var.project_name
  }
}

# -----------------------------------------------------------------------------
# SALES TRACKING TABLE - Direct and indirect sales revenue
# -----------------------------------------------------------------------------
resource "aws_dynamodb_table" "sales_tracking" {
  name           = "${var.project_name}-sales-tracking-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "tracking_id"
  
  attribute {
    name = "tracking_id"
    type = "S"
  }
  
  attribute {
    name = "vehicle_id"
    type = "S"
  }
  
  attribute {
    name = "completed_date"
    type = "S"
  }
  
  # GSI for querying by vehicle
  global_secondary_index {
    name            = "VehicleIndex"
    hash_key        = "vehicle_id"
    range_key       = "completed_date"
    projection_type = "ALL"
  }
  
  tags = {
    Name        = "${var.project_name}-sales-tracking"
    Environment = var.environment
    Project     = var.project_name
  }
}

# -----------------------------------------------------------------------------
# SETTINGS TABLE - User preferences and app configuration
# -----------------------------------------------------------------------------
resource "aws_dynamodb_table" "settings" {
  name           = "${var.project_name}-settings-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "user_id"
  range_key      = "setting_key"
  
  attribute {
    name = "user_id"
    type = "S"
  }
  
  attribute {
    name = "setting_key"
    type = "S"
  }
  
  tags = {
    Name        = "${var.project_name}-settings"
    Environment = var.environment
    Project     = var.project_name
  }
}

# -----------------------------------------------------------------------------
# ANALYTICS CACHE TABLE - Pre-calculated analytics for performance
# -----------------------------------------------------------------------------
resource "aws_dynamodb_table" "analytics_cache" {
  name           = "${var.project_name}-analytics-cache-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "cache_key"
  
  attribute {
    name = "cache_key"
    type = "S"
  }
  
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }
  
  tags = {
    Name        = "${var.project_name}-analytics-cache"
    Environment = var.environment
    Project     = var.project_name
  }
}

# -----------------------------------------------------------------------------
# OUTPUTS
# -----------------------------------------------------------------------------
output "repair_orders_table_name" {
  value = aws_dynamodb_table.repair_orders.name
}

output "contact_history_table_name" {
  value = aws_dynamodb_table.contact_history.name
}

output "appointments_table_name" {
  value = aws_dynamodb_table.appointments.name
}

output "sales_tracking_table_name" {
  value = aws_dynamodb_table.sales_tracking.name
}

output "settings_table_name" {
  value = aws_dynamodb_table.settings.name
}

output "analytics_cache_table_name" {
  value = aws_dynamodb_table.analytics_cache.name
}
