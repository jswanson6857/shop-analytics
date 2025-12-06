#!/bin/bash
set -e

echo "🚀 ReviveCRM Deployment Script"
echo "================================"
echo ""

# Check prerequisites
command -v terraform >/dev/null 2>&1 || { echo "❌ Terraform not installed"; exit 1; }
command -v aws >/dev/null 2>&1 || { echo "❌ AWS CLI not installed"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ Node.js not installed"; exit 1; }

echo "✅ Prerequisites check passed"
echo ""

# Deploy infrastructure
echo "📦 Deploying infrastructure..."
cd terraform/environments/prod
terraform init
terraform apply -auto-approve

# Get outputs
API_URL=$(terraform output -raw api_gateway_url)
S3_BUCKET=$(terraform output -raw s3_bucket_name)
CF_DIST_ID=$(terraform output -raw cloudfront_distribution_id)
CF_URL=$(terraform output -raw cloudfront_url)

echo ""
echo "✅ Infrastructure deployed"
echo "   API URL: $API_URL"
echo "   CloudFront URL: $CF_URL"
echo ""

# Deploy frontend
echo "🎨 Deploying frontend..."
cd ../../../frontend

# Create production env file
cat > .env.production << ENVEOF
REACT_APP_API_URL=$API_URL
REACT_APP_AUTH0_DOMAIN=dev-fugvz4vli76oqpqw.us.auth0.com
REACT_APP_AUTH0_CLIENT_ID=8OMklLM4zv5GsVZ8laNPOZK97IDDxoQP
ENVEOF

# Install and build
npm install
npm run build

# Deploy to S3
aws s3 sync build/ s3://$S3_BUCKET/ --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id $CF_DIST_ID --paths "/*"

echo ""
echo "✅ Frontend deployed"
echo ""
echo "🎉 DEPLOYMENT COMPLETE!"
echo ""
echo "📍 Your application is now live at:"
echo "   $CF_URL"
echo ""
echo "⚙️  Configure Auth0 callbacks:"
echo "   - Allowed Callback URLs: $CF_URL"
echo "   - Allowed Logout URLs: $CF_URL"
echo "   - Allowed Web Origins: $CF_URL"
echo ""
