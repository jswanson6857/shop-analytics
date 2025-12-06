# 🚀 REVIVECRM - COMPLETE SETUP GUIDE

## 📦 What You Have

A production-ready callback management system with:
- ✅ Complete infrastructure as code (Terraform)
- ✅ GitHub Actions CI/CD pipelines
- ✅ S3 + CloudFront frontend hosting
- ✅ 7 Lambda functions with full business logic
- ✅ 6 DynamoDB tables
- ✅ API Gateway REST API
- ✅ EventBridge automation

---

## 🏗️ Project Structure

```
revivecrm-production/
├── .github/workflows/          # CI/CD pipelines
│   ├── terraform-deploy.yml    # Deploy infrastructure
│   └── frontend-deploy.yml     # Deploy frontend
├── terraform/
│   ├── modules/
│   │   ├── backend/            # Lambda, DynamoDB, API Gateway
│   │   └── frontend/           # S3 + CloudFront
│   └── environments/
│       └── prod/               # Production config
├── lambdas/                    # 7 Lambda functions
│   ├── sync-tekmetric/
│   ├── api-ros/
│   ├── api-contact/
│   ├── api-users/
│   ├── api-analytics/
│   ├── batch-appointments/
│   └── batch-sales/
├── frontend/                   # React application
│   ├── src/
│   ├── public/
│   └── package.json
├── docs/                       # Documentation
├── deploy.sh                   # One-command deployment script
└── README.md
```

---

## 🎯 OPTION 1: Local Deployment (Recommended First Time)

### Step 1: Clone and Setup

```bash
# Extract the zip file
unzip revivecrm-production.zip
cd revivecrm-production

# Copy to your existing project (if needed)
# Or use this as your new project root
```

### Step 2: Configure AWS Credentials

```bash
# Configure AWS CLI
aws configure

# Verify access
aws sts get-caller-identity
```

### Step 3: Update Terraform Backend

Edit `terraform/environments/prod/main.tf`:

```hcl
backend "remote" {
  organization = "YOUR-TERRAFORM-CLOUD-ORG"  # Change this
  
  workspaces {
    name = "revivecrm-production"
  }
}
```

Or use local backend:

```hcl
backend "local" {
  path = "terraform.tfstate"
}
```

### Step 4: Deploy Everything

```bash
# One-command deployment
./deploy.sh
```

This script will:
1. Deploy infrastructure (Terraform)
2. Build frontend
3. Upload to S3
4. Invalidate CloudFront cache
5. Display your application URL

### Step 5: Configure Auth0

1. Go to Auth0 Dashboard
2. Navigate to your application settings
3. Add these URLs (using the CloudFront URL from deployment):
   - **Allowed Callback URLs**: `https://your-cloudfront-url.cloudfront.net`
   - **Allowed Logout URLs**: `https://your-cloudfront-url.cloudfront.net`
   - **Allowed Web Origins**: `https://your-cloudfront-url.cloudfront.net`

### Step 6: Access Your Application

Open the CloudFront URL displayed after deployment!

---

## 🎯 OPTION 2: GitHub Actions Deployment (For CI/CD)

### Step 1: Push to GitHub

```bash
# Initialize git (if not already)
git init
git add .
git commit -m "Initial commit"

# Push to your repository
git remote add origin <your-repo-url>
git push -u origin main
```

### Step 2: Configure GitHub Secrets

**📖 See complete guide:** [docs/GITHUB_SECRETS.md](./docs/GITHUB_SECRETS.md)

Go to **Settings → Secrets and variables → Actions** and add these 8 secrets:

**AWS Credentials:**
- `AWS_ACCESS_KEY_ID` (your AWS access key)
- `AWS_SECRET_ACCESS_KEY` (your AWS secret key)

**Terraform:**
- `TF_API_TOKEN` (from Terraform Cloud: https://app.terraform.io/app/settings/tokens)

**Tekmetric:**
- `TEKMETRIC_CLIENT_ID` = `b9ac67f0337844a6`
- `TEKMETRIC_CLIENT_SECRET` = `f4e9c0c039534a1696f7a12c`
- `TEKMETRIC_SHOP_ID` = `3389259`

**Auth0:**
- `AUTH0_DOMAIN` = `dev-fugvz4vli76oqpqw.us.auth0.com`
- `AUTH0_CLIENT_ID` = `8OMklLM4zv5GsVZ8laNPOZK97IDDxoQP`

**Note:** Frontend secrets are automatically handled by the workflow using Terraform outputs!

### Step 3: Deploy via GitHub Actions

```bash
# Push changes to main branch
git push origin main

# GitHub Actions will automatically:
# 1. Deploy infrastructure
# 2. Build and deploy frontend
```

### Step 4: Monitor Deployment

Go to **Actions** tab in your GitHub repository to see deployment progress.

---

## 💻 Local Development

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Edit .env.local with your values
nano .env.local

# Start development server
npm start
# Opens http://localhost:3000
```

### Testing Lambda Functions Locally

```bash
cd lambdas/sync-tekmetric

# Install dependencies
npm install

# Test locally (requires AWS credentials)
node -e "require('./index').handler({}, {}, console.log)"
```

---

## 🔧 Configuration Files

### Frontend Environment Variables

Create `frontend/.env.local`:

```bash
REACT_APP_API_URL=https://your-api-gateway-url/production
REACT_APP_AUTH0_DOMAIN=dev-fugvz4vli76oqpqw.us.auth0.com
REACT_APP_AUTH0_CLIENT_ID=8OMklLM4zv5GsVZ8laNPOZK97IDDxoQP
```

### Terraform Variables

Create `terraform/environments/prod/terraform.tfvars`:

```hcl
aws_region              = "us-east-1"
project_name            = "revivecrm"
environment             = "production"
tekmetric_client_id     = "b9ac67f0337844a6"
tekmetric_client_secret = "f4e9c0c039534a1696f7a12c"
tekmetric_shop_id       = "3389259"
auth0_domain            = "dev-fugvz4vli76oqpqw.us.auth0.com"
auth0_client_id         = "8OMklLM4zv5GsVZ8laNPOZK97IDDxoQP"
```

**⚠️ IMPORTANT:** Add `*.tfvars` to `.gitignore` (already done)

---

## 🧪 Testing the Deployment

### 1. Check Infrastructure

```bash
cd terraform/environments/prod
terraform output
```

### 2. Test API Endpoints

```bash
# Get API URL from Terraform output
API_URL=$(terraform output -raw api_gateway_url)

# Test users endpoint
curl $API_URL/users

# Test ROs endpoint
curl "$API_URL/ros?status=FOLLOW_UP_BOARD"
```

### 3. Test Frontend

Open CloudFront URL in browser and:
1. Click "Log In" (Auth0)
2. View Follow Up Board
3. Click an RO to see detail modal
4. Log a contact
5. Check Follow Up Tracker

---

## 📊 Monitoring

### CloudWatch Logs

```bash
# View Lambda logs
aws logs tail /aws/lambda/revivecrm-sync-tekmetric-production --follow

# View all Lambda function logs
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/revivecrm
```

### DynamoDB Tables

```bash
# List tables
aws dynamodb list-tables

# Scan repair orders
aws dynamodb scan --table-name revivecrm-repair-orders-production --max-items 10
```

### API Gateway Metrics

```bash
# View API Gateway metrics in AWS Console
# CloudWatch → Metrics → API Gateway → API Name
```

---

## 🔄 Making Changes

### Update Frontend

```bash
cd frontend

# Make your changes
# ...

# Test locally
npm start

# Deploy
npm run build
npm run deploy

# Or push to GitHub (if using CI/CD)
git add .
git commit -m "Update frontend"
git push origin main
```

### Update Backend

```bash
# Make changes to Lambda functions or Terraform

# Deploy via script
./deploy.sh

# Or push to GitHub (if using CI/CD)
git add .
git commit -m "Update backend"
git push origin main
```

---

## 🚨 Troubleshooting

### "Permission denied" error

```bash
chmod +x deploy.sh
```

### Terraform backend not found

Edit `terraform/environments/prod/main.tf` and configure your backend.

### CloudFront takes 15-20 minutes

This is normal for first-time CloudFront distribution creation.

### Frontend shows 404

CloudFront is still deploying. Wait 15-20 minutes and try again.

### API returns CORS error

Check API Gateway CORS configuration in `terraform/modules/backend/api-gateway.tf`

### Lambda timeout

Increase timeout in `terraform/modules/backend/lambda.tf`:

```hcl
timeout = 900  # 15 minutes
```

---

## 💰 Cost Estimation

**Monthly costs (low usage):**
- Lambda: $5
- DynamoDB: $10
- API Gateway: $3
- S3: $1
- CloudFront: $1
- Secrets Manager: $1

**Total: ~$20-25/month**

---

## 📚 Additional Documentation

- [Deployment Guide](./docs/DEPLOYMENT_GUIDE.md)
- [Build Summary](./docs/FINAL_BUILD_SUMMARY.md)
- [API Documentation](./docs/API.md)
- [User Guide](./docs/USER_GUIDE.md)

---

## 🎉 You're All Set!

Your ReviveCRM system is ready to:
- ✅ Sync ROs from Tekmetric automatically
- ✅ Track callback interactions
- ✅ Route by interest status
- ✅ Verify appointment show-ups
- ✅ Calculate direct/indirect sales
- ✅ Display real-time analytics

**Start transforming your callback process today!** 🚀

---

## 📞 Need Help?

1. Check [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)
2. Review CloudWatch logs
3. Check GitHub Actions logs (if using CI/CD)
4. Verify AWS credentials and permissions

**Your production-ready callback management system is ready to deploy!**
