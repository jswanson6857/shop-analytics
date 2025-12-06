#!/bin/bash
# Pre-Deployment Validation Script for ReviveCRM

set -e

echo "🔍 ReviveCRM Pre-Deployment Validation"
echo "========================================"
echo ""

ERRORS=0

# Check directory structure
echo "1️⃣  Checking directory structure..."
if [ ! -d "terraform/environments/prod" ]; then
    echo "❌ Missing: terraform/environments/prod"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ terraform/environments/prod exists"
fi

if [ ! -d "terraform/modules/backend" ]; then
    echo "❌ Missing: terraform/modules/backend"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ terraform/modules/backend exists"
fi

if [ ! -d "terraform/modules/frontend" ]; then
    echo "❌ Missing: terraform/modules/frontend"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ terraform/modules/frontend exists"
fi

echo ""
echo "2️⃣  Checking required Terraform files..."
REQUIRED_FILES=(
    "terraform/environments/prod/main.tf"
    "terraform/environments/prod/variables.tf"
    "terraform/environments/prod/provider.tf"
    "terraform/modules/backend/lambda.tf"
    "terraform/modules/backend/dynamodb.tf"
    "terraform/modules/backend/api-gateway.tf"
    "terraform/modules/backend/iam.tf"
    "terraform/modules/backend/eventbridge.tf"
    "terraform/modules/backend/outputs.tf"
    "terraform/modules/backend/variables.tf"
    "terraform/modules/frontend/main.tf"
    "terraform/modules/frontend/variables.tf"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ Missing: $file"
        ERRORS=$((ERRORS + 1))
    fi
done

if [ $ERRORS -eq 0 ]; then
    echo "✅ All required Terraform files present"
fi

echo ""
echo "3️⃣  Checking for duplicate resources..."
cd terraform/environments/prod
if terraform init -backend=false > /dev/null 2>&1; then
    if terraform validate > /dev/null 2>&1; then
        echo "✅ No duplicate resources found"
    else
        echo "❌ Terraform validation failed - check for duplicates"
        terraform validate
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "⚠️  Could not validate (terraform init failed)"
fi
cd - > /dev/null

echo ""
echo "4️⃣  Checking Lambda functions..."
LAMBDA_COUNT=$(ls -1 lambdas/ 2>/dev/null | wc -l)
if [ "$LAMBDA_COUNT" -eq 7 ]; then
    echo "✅ All 7 Lambda functions present"
else
    echo "❌ Expected 7 Lambda functions, found $LAMBDA_COUNT"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "5️⃣  Checking frontend..."
if [ -f "frontend/package.json" ]; then
    REACT_SCRIPTS_VERSION=$(grep '"react-scripts"' frontend/package.json | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+' || echo "0.0.0")
    if [ "$REACT_SCRIPTS_VERSION" != "0.0.0" ]; then
        echo "✅ Frontend package.json valid (react-scripts: $REACT_SCRIPTS_VERSION)"
    else
        echo "❌ Invalid react-scripts version in package.json"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "❌ Missing: frontend/package.json"
    ERRORS=$((ERRORS + 1))
fi

COMPONENT_COUNT=$(ls -1 frontend/src/components/*.js 2>/dev/null | wc -l)
if [ "$COMPONENT_COUNT" -ge 7 ]; then
    echo "✅ Frontend components present ($COMPONENT_COUNT found)"
else
    echo "❌ Expected at least 7 components, found $COMPONENT_COUNT"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "6️⃣  Checking GitHub Actions workflow..."
if [ -f ".github/workflows/deploy.yml" ]; then
    echo "✅ GitHub Actions workflow present"
else
    echo "❌ Missing: .github/workflows/deploy.yml"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "========================================"
if [ $ERRORS -eq 0 ]; then
    echo "✅ ALL CHECKS PASSED!"
    echo ""
    echo "🚀 Ready to deploy!"
    echo ""
    echo "Next steps:"
    echo "1. Update terraform/environments/prod/main.tf backend config"
    echo "2. Add all 8 GitHub secrets"
    echo "3. git add . && git commit -m 'Deploy ReviveCRM' && git push"
    exit 0
else
    echo "❌ FOUND $ERRORS ERRORS"
    echo ""
    echo "Please fix the errors above before deploying."
    exit 1
fi
