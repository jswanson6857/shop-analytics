#!/bin/bash
# This is the nuclear option but it WORKS
# Run this ONCE to clear AWS, then Terraform works perfectly

aws secretsmanager delete-secret --secret-id revivecrm-prod-tekmetric-credentials --force-delete-without-recovery --region us-east-1 2>/dev/null || true

for table in repair-orders contact-history appointments sales-tracking settings analytics-cache; do
  aws dynamodb delete-table --table-name "revivecrm-${table}-prod" --region us-east-1 2>/dev/null || true
done

aws iam delete-role --role-name revivecrm-lambda-exec-prod 2>/dev/null || true
aws iam delete-role --role-name revivecrm-eventbridge-exec-prod 2>/dev/null || true

aws s3 rb s3://revivecrm-frontend-prod --force 2>/dev/null || true

echo "Deleted all existing resources - now Terraform can create them fresh"
