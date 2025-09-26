#!/bin/bash

# troubleshoot.sh - Auto Shop Dashboard Troubleshooting Script

set -e

echo "🔍 Auto Shop Dashboard Troubleshooting"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Check if we're in the right directory
if [ ! -d "terraform" ] || [ ! -d "frontend" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Get Terraform outputs
print_status "Getting infrastructure information..."
cd terraform

if [ ! -f "terraform.tfstate" ]; then
    print_error "Terraform state not found. Have you deployed the infrastructure?"
    exit 1
fi

WEBSOCKET_URL=$(terraform output -raw websocket_api_url 2>/dev/null || echo "NOT_FOUND")
S3_BUCKET=$(terraform output -raw s3_bucket_name 2>/dev/null || echo "NOT_FOUND")
CLOUDFRONT_URL=$(terraform output -raw cloudfront_url 2>/dev/null || echo "NOT_FOUND")
CLOUDFRONT_DIST_ID=$(terraform output -raw cloudfront_distribution_id 2>/dev/null || echo "NOT_FOUND")
WEBHOOK_URL=$(terraform output -raw webhook_endpoint 2>/dev/null || echo "NOT_FOUND")

cd ..

echo ""
echo "📋 Current Configuration:"
echo "========================"
echo "WebSocket URL: $WEBSOCKET_URL"
echo "S3 Bucket: $S3_BUCKET"
echo "CloudFront URL: $CLOUDFRONT_URL"
echo "Webhook URL: $WEBHOOK_URL"
echo ""

# Test 1: Infrastructure Check
print_status "Test 1: Checking AWS infrastructure..."

if [ "$WEBSOCKET_URL" = "NOT_FOUND" ]; then
    print_error "WebSocket API not found"
else
    print_success "WebSocket API found"
fi

if [ "$S3_BUCKET" = "NOT_FOUND" ]; then
    print_error "S3 bucket not found"
else
    print_success "S3 bucket found"
fi

if [ "$CLOUDFRONT_URL" = "NOT_FOUND" ]; then
    print_error "CloudFront distribution not found"
else
    print_success "CloudFront distribution found"
fi

# Test 2: S3 Content Check
print_status "Test 2: Checking S3 content..."

if [ "$S3_BUCKET" != "NOT_FOUND" ]; then
    S3_FILES=$(aws s3 ls s3://$S3_BUCKET/ --recursive | wc -l)
    if [ "$S3_FILES" -gt 0 ]; then
        print_success "S3 bucket contains $S3_FILES files"
        
        # Check for index.html
        if aws s3 ls s3://$S3_BUCKET/index.html > /dev/null 2>&1; then
            print_success "index.html found in S3"
        else
            print_error "index.html not found in S3"
        fi
        
        # Check for static files
        JS_FILES=$(aws s3 ls s3://$S3_BUCKET/ --recursive | grep -c "\.js$" || echo "0")
        CSS_FILES=$(aws s3 ls s3://$S3_BUCKET/ --recursive | grep -c "\.css$" || echo "0")
        print_status "Found $JS_FILES JavaScript files and $CSS_FILES CSS files"
        
    else
        print_error "S3 bucket is empty"
    fi
else
    print_warning "Skipping S3 content check (bucket not found)"
fi

# Test 3: CloudFront Response
print_status "Test 3: Testing CloudFront response..."

if [ "$CLOUDFRONT_URL" != "NOT_FOUND" ]; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$CLOUDFRONT_URL" || echo "000")
    
    case $HTTP_CODE in
        200)
            print_success "CloudFront responding with HTTP 200"
            ;;
        403)
            print_error "CloudFront responding with HTTP 403 (Forbidden) - Check S3 permissions"
            ;;
        404)
            print_error "CloudFront responding with HTTP 404 (Not Found) - Check S3 content"
            ;;
        000)
            print_error "Cannot connect to CloudFront URL"
            ;;
        *)
            print_warning "CloudFront responding with HTTP $HTTP_CODE"
            ;;
    esac
else
    print_warning "Skipping CloudFront test (URL not found)"
fi

# Test 4: WebSocket Connection
print_status "Test 4: Testing WebSocket connection..."

if [ "$WEBSOCKET_URL" != "NOT_FOUND" ]; then
    # Install wscat if not present
    if ! command -v wscat &> /dev/null; then
        print_warning "wscat not installed. Install with: npm install -g wscat"
    else
        print_status "Testing WebSocket connection with wscat..."
        timeout 5s wscat -c "$WEBSOCKET_URL" --no-check <<< "ping" > /tmp/wstest 2>&1 || true
        
        if grep -q "connected" /tmp/wstest; then
            print_success "WebSocket connection successful"
        else
            print_error "WebSocket connection failed"
            echo "WebSocket test output:"
            cat /tmp/wstest
        fi
        rm -f /tmp/wstest
    fi
else
    print_warning "Skipping WebSocket test (URL not found)"
fi

# Test 5: Webhook Endpoint
print_status "Test 5: Testing webhook endpoint..."

if [ "$WEBHOOK_URL" != "NOT_FOUND" ]; then
    WEBHOOK_RESPONSE=$(curl -s -w "%{http_code}" -X POST "$WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d '{"test": true, "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' || echo "000")
    
    WEBHOOK_CODE="${WEBHOOK_RESPONSE: -3}"
    
    case $WEBHOOK_CODE in
        200)
            print_success "Webhook endpoint responding with HTTP 200"
            ;;
        403)
            print_error "Webhook endpoint responding with HTTP 403 (Forbidden)"
            ;;
        404)
            print_error "Webhook endpoint responding with HTTP 404 (Not Found)"
            ;;
        500)
            print_error "Webhook endpoint responding with HTTP 500 (Internal Server Error)"
            ;;
        000)
            print_error "Cannot connect to webhook endpoint"
            ;;
        *)
            print_warning "Webhook endpoint responding with HTTP $WEBHOOK_CODE"
            ;;
    esac
else
    print_warning "Skipping webhook test (URL not found)"
fi

# Test 6: Lambda Functions
print_status "Test 6: Checking Lambda functions..."

LAMBDA_FUNCTIONS=$(aws lambda list-functions --query 'Functions[?starts_with(FunctionName, `webhook-ingestion`)].FunctionName' --output text)

if [ -n "$LAMBDA_FUNCTIONS" ]; then
    print_success "Found Lambda functions: $LAMBDA_FUNCTIONS"
    
    for func in $LAMBDA_FUNCTIONS; do
        STATUS=$(aws lambda get-function --function-name "$func" --query 'Configuration.State' --output text 2>/dev/null || echo "ERROR")
        if [ "$STATUS" = "Active" ]; then
            print_success "Lambda function $func is active"
        else
            print_error "Lambda function $func status: $STATUS"
        fi
    done
else
    print_error "No Lambda functions found"
fi

# Test 7: DynamoDB Tables
print_status "Test 7: Checking DynamoDB tables..."

DYNAMO_TABLES=$(aws dynamodb list-tables --query 'TableNames[?contains(@, `webhook-ingestion`)]' --output text)

if [ -n "$DYNAMO_TABLES" ]; then
    print_success "Found DynamoDB tables: $DYNAMO_TABLES"
    
    for table in $DYNAMO_TABLES; do
        STATUS=$(aws dynamodb describe-table --table-name "$table" --query 'Table.TableStatus' --output text 2>/dev/null || echo "ERROR")
        if [ "$STATUS" = "ACTIVE" ]; then
            print_success "DynamoDB table $table is active"
        else
            print_error "DynamoDB table $table status: $STATUS"
        fi
    done
else
    print_error "No DynamoDB tables found"
fi

# Test 8: Environment File Check
print_status "Test 8: Checking frontend environment configuration..."

if [ -f "frontend/.env" ]; then
    print_success "Frontend .env file exists"
    echo "Contents:"
    cat frontend/.env | sed 's/^/    /'
    
    if grep -q "REACT_APP_WEBSOCKET_URL" frontend/.env; then
        ENV_WEBSOCKET_URL=$(grep "REACT_APP_WEBSOCKET_URL" frontend/.env | cut -d'=' -f2)
        if [ "$ENV_WEBSOCKET_URL" = "$WEBSOCKET_URL" ]; then
            print_success "Environment WebSocket URL matches infrastructure"
        else
            print_error "Environment WebSocket URL doesn't match infrastructure"
            echo "    Environment: $ENV_WEBSOCKET_URL"
            echo "    Infrastructure: $WEBSOCKET_URL"
        fi
    else
        print_error "REACT_APP_WEBSOCKET_URL not found in .env file"
    fi
else
    print_error "Frontend .env file not found"
fi

# Summary and Recommendations
echo ""
echo "🔧 TROUBLESHOOTING SUMMARY"
echo "========================="
echo ""

if [ "$CLOUDFRONT_URL" != "NOT_FOUND" ]; then
    echo "📊 Dashboard URL: $CLOUDFRONT_URL"
    echo ""
fi

echo "💡 Common Solutions:"
echo ""
echo "1. If CloudFront returns 403/404:"
echo "   - Run: aws s3api put-bucket-acl --bucket $S3_BUCKET --acl public-read"
echo "   - Redeploy frontend: cd frontend && npm run build && aws s3 sync build/ s3://$S3_BUCKET/"
echo ""
echo "2. If WebSocket connection fails:"
echo "   - Check Lambda function logs: aws logs tail /aws/lambda/webhook-ingestion-websocket-handler"
echo "   - Verify API Gateway WebSocket API is deployed"
echo ""
echo "3. If no data appears on dashboard:"
echo "   - Test webhook: curl -X POST $WEBHOOK_URL -H 'Content-Type: application/json' -d '{\"test\":true}'"
echo "   - Check DynamoDB for data: aws dynamodb scan --table-name webhook-ingestion-webhook-data"
echo ""
echo "4. If environment variables are wrong:"
echo "   - Update frontend/.env with correct WebSocket URL"
echo "   - Rebuild and redeploy: npm run build && aws s3 sync build/ s3://$S3_BUCKET/"
echo ""
echo "5. Clear CloudFront cache:"
echo "   - aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_DIST_ID --paths '/*'"
echo ""
print_success "Troubleshooting complete!"