#!/bin/bash

# deploy.sh - Auto Shop Dashboard Deployment Script

set -e  # Exit on any error

echo "🚀 Starting Auto Shop Dashboard Deployment"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
print_status "Checking prerequisites..."

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if Terraform is installed
if ! command -v terraform &> /dev/null; then
    print_error "Terraform is not installed. Please install it first."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install it first."
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials not configured. Run 'aws configure' first."
    exit 1
fi

print_success "All prerequisites met!"

# Step 1: Deploy Infrastructure
print_status "Step 1: Deploying infrastructure with Terraform..."
cd terraform

# Initialize Terraform
print_status "Initializing Terraform..."
terraform init

# Plan deployment
print_status "Planning Terraform deployment..."
terraform plan -out=tfplan

# Apply deployment
print_status "Applying Terraform deployment..."
terraform apply tfplan

# Get outputs
print_status "Getting Terraform outputs..."
WEBSOCKET_URL=$(terraform output -raw websocket_api_url)
S3_BUCKET=$(terraform output -raw s3_bucket_name)
CLOUDFRONT_URL=$(terraform output -raw cloudfront_url)
CLOUDFRONT_DIST_ID=$(terraform output -raw cloudfront_distribution_id)
WEBHOOK_URL=$(terraform output -raw webhook_endpoint)

print_success "Infrastructure deployed successfully!"
echo "WebSocket URL: $WEBSOCKET_URL"
echo "S3 Bucket: $S3_BUCKET"
echo "CloudFront URL: $CLOUDFRONT_URL"

cd ..

# Step 2: Build and Deploy Frontend
print_status "Step 2: Building and deploying frontend..."
cd frontend

# Install dependencies
print_status "Installing Node.js dependencies..."
rm -f package-lock.json
npm install

# Create environment file
print_status "Creating environment configuration..."
cat > .env << EOF
REACT_APP_WEBSOCKET_URL=$WEBSOCKET_URL
NODE_ENV=production
EOF

print_success "Environment file created:"
cat .env

# Build React app
print_status "Building React application..."
npm run build

# Verify build
print_status "Verifying build output..."
if [ ! -d "build" ]; then
    print_error "Build directory not found!"
    exit 1
fi

print_success "React app built successfully!"

# Deploy to S3
print_status "Deploying to S3..."

# Clear existing files
print_status "Clearing existing S3 files..."
aws s3 rm s3://$S3_BUCKET/ --recursive

# Upload files with proper content types
print_status "Uploading HTML files..."
find build -name "*.html" -exec aws s3 cp {} s3://$S3_BUCKET/{} \
  --content-type "text/html; charset=utf-8" \
  --cache-control "no-cache, no-store, must-revalidate" \
  --metadata-directive REPLACE \;

print_status "Uploading CSS files..."
find build -name "*.css" -exec aws s3 cp {} s3://$S3_BUCKET/{} \
  --content-type "text/css; charset=utf-8" \
  --cache-control "max-age=31536000" \
  --metadata-directive REPLACE \;

print_status "Uploading JavaScript files..."
find build -name "*.js" -exec aws s3 cp {} s3://$S3_BUCKET/{} \
  --content-type "application/javascript; charset=utf-8" \
  --cache-control "max-age=31536000" \
  --metadata-directive REPLACE \;

print_status "Uploading JSON files..."
find build -name "*.json" -exec aws s3 cp {} s3://$S3_BUCKET/{} \
  --content-type "application/json; charset=utf-8" \
  --cache-control "max-age=31536000" \
  --metadata-directive REPLACE \;

print_status "Uploading remaining files..."
aws s3 sync build/ s3://$S3_BUCKET/ \
  --exclude "*.html" --exclude "*.css" --exclude "*.js" --exclude "*.json" \
  --cache-control "max-age=31536000" \
  --metadata-directive REPLACE

# Set public permissions
print_status "Setting public permissions..."
aws s3api put-bucket-acl --bucket $S3_BUCKET --acl public-read

print_success "Files uploaded to S3!"

cd ..

# Step 3: Invalidate CloudFront
print_status "Step 3: Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
  --distribution-id $CLOUDFRONT_DIST_ID \
  --paths "/*" > /dev/null

print_success "CloudFront invalidation created!"

# Step 4: Wait and test
print_status "Step 4: Waiting for deployment to propagate..."
print_warning "Waiting 60 seconds for CloudFront to update..."
sleep 60

# Test deployment
print_status "Testing deployment..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $CLOUDFRONT_URL)

if [ "$HTTP_CODE" = "200" ]; then
    print_success "Deployment test passed! (HTTP $HTTP_CODE)"
else
    print_warning "Deployment test returned HTTP $HTTP_CODE (may be normal immediately after deployment)"
fi

# Step 5: Test webhook endpoint
print_status "Step 5: Testing webhook endpoint..."
WEBHOOK_RESPONSE=$(curl -s -w "%{http_code}" -X POST $WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "repairOrderNumber": 99999,
      "repairOrderStatus": {"name": "Work-In-Progress"},
      "repairOrderCustomLabel": {"name": "Deployment Test"},
      "totalSales": 25000,
      "amountPaid": 0,
      "customerId": 12345,
      "vehicleId": 67890,
      "jobs": []
    },
    "event": "Test repair order created by deployment script"
  }')

WEBHOOK_CODE="${WEBHOOK_RESPONSE: -3}"
if [ "$WEBHOOK_CODE" = "200" ]; then
    print_success "Webhook test passed! (HTTP $WEBHOOK_CODE)"
else
    print_error "Webhook test failed! (HTTP $WEBHOOK_CODE)"
fi

# Final output
echo ""
echo "🎉 DEPLOYMENT COMPLETE!"
echo "======================"
echo ""
print_success "Your Auto Shop Dashboard is now live!"
echo ""
echo "📊 Dashboard URL (share this with users):"
echo "   $CLOUDFRONT_URL"
echo ""
echo "🔗 WebSocket URL (for debugging):"
echo "   $WEBSOCKET_URL"
echo ""
echo "📡 Webhook URL (configure in your auto shop system):"
echo "   $WEBHOOK_URL"
echo ""
echo "💡 Next Steps:"
echo "   1. Test the dashboard URL in multiple browsers/devices"
echo "   2. Configure your auto shop system to send webhooks to the webhook URL"
echo "   3. Monitor CloudWatch logs for any issues"
echo ""
print_warning "Note: It may take 5-15 minutes for CloudFront changes to propagate globally"
echo ""
print_success "Deployment script completed successfully!"