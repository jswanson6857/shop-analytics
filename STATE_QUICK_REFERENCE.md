# 🔐 State Management - Quick Reference

## 🎯 The Problem

**"When deploying over and over, make sure we know the state so we don't create duplicate resources in AWS"**

## ✅ The Solution

Start with local backend → Bootstrap S3/DynamoDB → Migrate to S3 backend → Deploy!

---

## ⚡ Quick Setup (5 Steps)

```bash
# 1. Bootstrap state infrastructure
cd terraform/bootstrap
terraform init
terraform apply
BUCKET=$(terraform output -raw state_bucket_name)

# 2. Update main.tf
cd ../environments/prod
# Edit main.tf:
# - Comment out "backend local"
# - Uncomment "backend s3"  
# - Set bucket = "$BUCKET"

# 3. Migrate state
terraform init -migrate-state  # Type: yes

# 4. Add GitHub secrets (8 total)

# 5. Deploy
cd ../../..
git push origin main
```

---

## 🔍 Why This Order?

### ❌ Wrong (fails):
```
git push → GitHub Actions
  ↓
terraform init → Tries to connect to S3 backend
  ↓
ERROR: Backend doesn't exist!
```

### ✅ Right (works):
```
Bootstrap locally → Creates S3 + DynamoDB
  ↓
Update main.tf → Point to S3
  ↓
Migrate state → Move local → S3
  ↓
git push → GitHub Actions
  ↓
terraform init → Connects to S3 (exists!)
  ↓
SUCCESS!
```

---

## 📊 What Gets Created

**Bootstrap creates (locally):**
- S3 bucket: `revivecrm-terraform-state-123456789012`
- DynamoDB table: `revivecrm-terraform-locks`

**Main infrastructure uses (after migration):**
- Reads state from S3
- Locks state with DynamoDB
- NO DUPLICATES!

---

## 🔒 State Locking

```
Deploy #1: Locks → Creates 7 Lambdas → Saves state → Unlocks
Deploy #2: Locks → Reads state → Sees 7 Lambdas → Updates → Unlocks
Deploy #3: Locks → Reads state → Sees 7 Lambdas → Updates → Unlocks

Result: Always 7 Lambdas (same ones!)
```

---

## ✅ Verification

```bash
# Check bucket exists
cd terraform/bootstrap
terraform output state_bucket_name

# Check state is in S3
# After first GitHub Actions deploy, state will be at:
# s3://BUCKET-NAME/production/terraform.tfstate
```

---

## 📖 Full Documentation

See `DEPLOYMENT_ORDER.md` for step-by-step instructions.

---

**Bootstrap first, then deploy. No duplicates!** 🔐✨
