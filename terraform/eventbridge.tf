# ==============================================================================
# EVENTBRIDGE SCHEDULES - AUTOMATED BATCH JOBS
# ==============================================================================

# -----------------------------------------------------------------------------
# Daily Tekmetric Sync - 4 AM daily
# -----------------------------------------------------------------------------
resource "aws_cloudwatch_event_rule" "sync_tekmetric_daily" {
  name                = "${var.project_name}-sync-tekmetric-daily-${var.environment}"
  description         = "Trigger Tekmetric sync daily at 4 AM"
  schedule_expression = "cron(0 4 * * ? *)" # 4 AM UTC daily
}

resource "aws_cloudwatch_event_target" "sync_tekmetric_daily" {
  rule      = aws_cloudwatch_event_rule.sync_tekmetric_daily.name
  target_id = "SyncTekmetricLambda"
  arn       = aws_lambda_function.sync_tekmetric.arn
}

resource "aws_lambda_permission" "allow_eventbridge_sync" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.sync_tekmetric.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.sync_tekmetric_daily.arn
}

# -----------------------------------------------------------------------------
# Appointment Verification - Every hour
# -----------------------------------------------------------------------------
resource "aws_cloudwatch_event_rule" "verify_appointments_hourly" {
  name                = "${var.project_name}-verify-appointments-hourly-${var.environment}"
  description         = "Verify appointments every hour"
  schedule_expression = "rate(1 hour)"
}

resource "aws_cloudwatch_event_target" "verify_appointments_hourly" {
  rule      = aws_cloudwatch_event_rule.verify_appointments_hourly.name
  target_id = "VerifyAppointmentsLambda"
  arn       = aws_lambda_function.batch_appointments.arn
}

resource "aws_lambda_permission" "allow_eventbridge_appointments" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.batch_appointments.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.verify_appointments_hourly.arn
}

# -----------------------------------------------------------------------------
# Sales Tracking - Midnight daily
# -----------------------------------------------------------------------------
resource "aws_cloudwatch_event_rule" "track_sales_daily" {
  name                = "${var.project_name}-track-sales-daily-${var.environment}"
  description         = "Track direct/indirect sales daily at midnight"
  schedule_expression = "cron(0 0 * * ? *)" # Midnight UTC daily
}

resource "aws_cloudwatch_event_target" "track_sales_daily" {
  rule      = aws_cloudwatch_event_rule.track_sales_daily.name
  target_id = "TrackSalesLambda"
  arn       = aws_lambda_function.batch_sales.arn
}

resource "aws_lambda_permission" "allow_eventbridge_sales" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.batch_sales.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.track_sales_daily.arn
}
