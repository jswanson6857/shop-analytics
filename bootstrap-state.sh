#!/bin/bash
# ==============================================================================
# TERRAFORM STATE INFRASTRUCTURE BOOTSTRAP
# ==============================================================================
# This creates the S3 bucket and DynamoDB table for Terraform state management
# Run this ONCE before deploying your main infrastructure
# ==============================================================================

set -e

echo "🔐 Setting up Terraform State Management"
echo "=========================================="
echo ""

cd terraform/bootstrap

echo "📦 Initializing Terraform..."
terraform init

echo ""
echo "📋 Planning state infrastructure..."
terraform plan

echo ""
read -p "🚀 Create state infrastructure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Aborted"
    exit 1
fi

echo ""
echo "🔧 Creating S3 bucket and DynamoDB table..."
terraform apply -auto-approve

echo ""
echo "✅ State infrastructure created!"
echo ""

# Get bucket name from output
BUCKET_NAME=$(terraform output -raw state_bucket_name)
LOCK_TABLE=$(terraform output -raw lock_table_name)

echo "📋 Configuration:"
echo "  Bucket: $BUCKET_NAME"
echo "  Table:  $LOCK_TABLE"
echo ""

# Update main.tf
echo "📝 Updating main.tf with bucket name..."
cd ../..
sed -i.bak "s/revivecrm-terraform-state-YOUR-UNIQUE-ID/$BUCKET_NAME/g" terraform/environments/prod/main.tf

if [ $? -eq 0 ]; then
    echo "✅ Updated terraform/environments/prod/main.tf"
    rm terraform/environments/prod/main.tf.bak 2>/dev/null || true
else
    echo "⚠️  Could not update main.tf automatically"
    echo "   Please update it manually with: $BUCKET_NAME"
fi

echo ""
echo "=========================================="
echo "✅ SETUP COMPLETE!"
echo "=========================================="
echo ""
echo "🎯 Next steps:"
echo ""
echo "1. Commit the changes:"
echo "   git add ."
echo "   git commit -m 'Configure state backend'"
echo ""
echo "2. Push to deploy:"
echo "   git push origin main"
echo ""
echo "🔐 Your infrastructure will now:"
echo "  ✅ Store state in S3: $BUCKET_NAME"
echo "  ✅ Lock state with DynamoDB: $LOCK_TABLE"
echo "  ✅ Prevent duplicate resources on every deploy!"
echo ""
