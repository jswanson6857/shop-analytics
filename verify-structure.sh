#!/bin/bash

echo "🔍 Verifying ReviveCRM Structure..."
echo ""

errors=0

# Check required files
required_files=(
    "README.md"
    "SETUP.md"
    "START_HERE.md"
    "deploy.sh"
    ".gitignore"
    "terraform/environments/prod/main.tf"
    "terraform/modules/backend/dynamodb.tf"
    "terraform/modules/frontend/main.tf"
    "frontend/package.json"
    "frontend/src/App.js"
    ".github/workflows/terraform-deploy.yml"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ MISSING: $file"
        ((errors++))
    fi
done

# Check Lambda functions
echo ""
echo "🔍 Checking Lambda functions..."
lambdas=("sync-tekmetric" "api-ros" "api-contact" "api-users" "api-analytics" "batch-appointments" "batch-sales")

for lambda in "${lambdas[@]}"; do
    if [ -f "lambdas/$lambda/index.js" ] && [ -f "lambdas/$lambda/package.json" ]; then
        echo "✅ lambdas/$lambda/"
    else
        echo "❌ MISSING: lambdas/$lambda/"
        ((errors++))
    fi
done

# Check frontend components
echo ""
echo "🔍 Checking frontend components..."
components=("RODetailModal" "FollowUpBoard" "FollowUpTracker" "AppointmentTracker" "ReturnSalesTracker" "LoginPage" "LogoutPage")

for comp in "${components[@]}"; do
    if [ -f "frontend/src/components/$comp.js" ]; then
        echo "✅ frontend/src/components/$comp.js"
    else
        echo "❌ MISSING: frontend/src/components/$comp.js"
        ((errors++))
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $errors -eq 0 ]; then
    echo "✅ ALL CHECKS PASSED!"
    echo ""
    echo "📦 Your ReviveCRM package is complete and ready to deploy!"
    echo ""
    echo "Next steps:"
    echo "1. Read START_HERE.md"
    echo "2. Follow SETUP.md"
    echo "3. Run ./deploy.sh"
else
    echo "❌ $errors ERRORS FOUND"
    echo ""
    echo "Some files are missing. Please review the structure."
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
