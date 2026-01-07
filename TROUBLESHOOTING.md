# ReviveCRM Troubleshooting Guide

## To Test Tekmetric Integration Right Now

### Option 1: Manually Trigger Sync Lambda (AWS Console)
1. Go to AWS Console → Lambda → `revivecrm-sync-tekmetric-prod`
2. Click "Test" tab
3. Create new test event (any JSON like `{}`)
4. Click "Test" button
5. Check logs - should see:
   - "🔐 Getting OAuth token from Tekmetric..."
   - "✅ Got access token"
   - "📥 Fetching repair orders from Tekmetric..."
   - "✅ Fetched X repair orders"
   - "✅ Sync complete: X new ROs, X skipped"

### Option 2: Check CloudWatch Logs
1. AWS Console → CloudWatch → Log Groups
2. Look for `/aws/lambda/revivecrm-sync-tekmetric-prod`
3. Check latest log stream for errors

### Option 3: Test API Endpoints Directly

**Test if API Gateway is working:**
```bash
# Get your API URL from terraform outputs
API_URL="https://[your-api-id].execute-api.us-east-1.amazonaws.com/prod"

# Test /ros endpoint
curl "$API_URL/ros?status=FOLLOW_UP_BOARD"

# Test /users endpoint  
curl "$API_URL/users"
```

### Common Issues

**1. No data showing in app**
- Sync hasn't run yet (runs at 4 AM UTC daily)
- No ROs with declined jobs in last 90 days
- Check Lambda logs for errors

**2. API calls failing**
- Check browser console (F12) for error messages
- Look for CORS errors
- Check if API_URL is correct in Network tab

**3. Tekmetric authentication failing**
- Verify secrets in Secrets Manager match your credentials:
  - client_id: b9ac67f0337844a6
  - client_secret: f4e9c0c039534a1696f7a12c
  - shop_id: 3389259

**4. Lambda timeout/errors**
- Check CloudWatch logs
- Look for "OAuth token" - if this fails, credentials are wrong
- Look for "403" or "401" - authentication issue

## What the App Should Do

1. **sync-tekmetric Lambda** (runs daily at 4 AM UTC):
   - Fetches last 90 days of Posted ROs from Tekmetric
   - Filters for ROs with declined jobs
   - Stores in DynamoDB with status "FOLLOW_UP_BOARD"

2. **Frontend loads** and calls:
   - `GET /ros?status=FOLLOW_UP_BOARD` - Gets ROs to display
   - `GET /users` - Gets service writers
   - `POST /contact` - Saves contact attempts
   - `GET /analytics` - Gets stats

3. **You should see**:
   - Follow-Up Board with ROs grouped by category
   - Click RO → See declined jobs, customer info
   - Make contact → Saves to history
   - Move to appointments/sales tracking

## Quick Diagnostic

Check these in order:

1. ✅ **Secrets configured?** 
   - AWS Console → Secrets Manager → `revivecrm-prod-tekmetric-credentials`
   - Should have client_id, client_secret, shop_id

2. ✅ **Lambda deployed?**
   - AWS Console → Lambda → Should see 7 functions

3. ✅ **DynamoDB tables exist?**
   - AWS Console → DynamoDB → Should see 6 tables

4. ✅ **API Gateway deployed?**
   - AWS Console → API Gateway → `revivecrm-api-prod`

5. ✅ **Frontend deployed?**
   - CloudFront URL should load the app

6. ✅ **Sync has run?**
   - CloudWatch Logs → `/aws/lambda/revivecrm-sync-tekmetric-prod`
   - Should have log entries (or wait until 4 AM UTC)

## To Force Sync Now

**Create this file: force-sync.sh**
```bash
#!/bin/bash
aws lambda invoke \
  --function-name revivecrm-sync-tekmetric-prod \
  --region us-east-1 \
  response.json

cat response.json
```

Run: `./force-sync.sh`

This will trigger the sync immediately instead of waiting for 4 AM.
