# ReviveCRM - Tekmetric Integration

## Quick Start

### 1. Add GitHub Secrets

Add these 5 secrets in your repo (Settings → Secrets):

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `TEKMETRIC_CLIENT_ID` = `b9ac67f0337844a6`
- `TEKMETRIC_CLIENT_SECRET` = `f4e9c0c039534a1696f7a12c`
- `TEKMETRIC_SHOP_ID` = `3389259`

### 2. Fix Existing Resources (ONE TIME)

If you have existing resources in AWS:

1. Go to Actions → **Reset AWS (Delete Everything)**
2. Run workflow
3. Wait 2 minutes

### 3. Deploy

Push to main branch OR run **Deploy ReviveCRM** workflow.

That's it. Future pushes auto-deploy.

## What Gets Deployed

- 7 Lambda functions
- 6 DynamoDB tables
- API Gateway
- EventBridge schedules
- React frontend on S3/CloudFront
- Secrets Manager for Tekmetric credentials

## State Management

State is stored in S3 bucket: `revivecrm-terraform-state-095289934716`

This prevents duplicate resources on every deploy.
