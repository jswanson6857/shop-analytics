# 🚀 Deploy ReviveCRM - Start Here!

## ⚠️ CRITICAL: Follow Steps IN ORDER

**Read `DEPLOYMENT_ORDER.md` for complete details.**

---

## 📋 Quick Steps

### 1. Bootstrap (creates S3 + DynamoDB)
```bash
cd terraform/bootstrap
terraform init
terraform apply  # Type: yes
terraform output -raw state_bucket_name  # COPY THIS!
```

### 2. Update main.tf with bucket name
```bash
cd ../environments/prod
nano main.tf  # Or your editor

# COMMENT OUT lines ~20-22:
# backend "local" {
#   path = "terraform.tfstate"
# }

# UNCOMMENT lines ~27-33 and UPDATE bucket name:
backend "s3" {
  bucket         = "PASTE-BUCKET-NAME-HERE"
  key            = "production/terraform.tfstate"
  region         = "us-east-1"
  encrypt        = true
  dynamodb_table = "revivecrm-terraform-locks"
}
```

### 3. Migrate state to S3
```bash
terraform init -migrate-state  # Type: yes
```

### 4. Add GitHub Secrets

Go to: **Settings → Secrets → Actions**

| Secret | Value |
|--------|-------|
| AWS_ACCESS_KEY_ID | Your AWS key |
| AWS_SECRET_ACCESS_KEY | Your AWS secret |
| TEKMETRIC_CLIENT_ID | b9ac67f0337844a6 |
| TEKMETRIC_CLIENT_SECRET | f4e9c0c039534a1696f7a12c |
| TEKMETRIC_SHOP_ID | 3389259 |
| AUTH0_DOMAIN | dev-fugvz4vli76oqpqw.us.auth0.com |
| AUTH0_CLIENT_ID | 8OMklLM4zv5GsVZ8laNPOZK97IDDxoQP |

### 5. Deploy!
```bash
cd ../../..  # Back to root
git add .
git commit -m "Deploy ReviveCRM"
git push origin main
```

---

## ✅ Success Indicators

- GitHub Actions workflow completes ✅
- CloudFront URL in Actions output ✅
- No "Error configuring S3 Backend" ✅

---

## 🆘 If You Get "Error configuring S3 Backend"

**You skipped step 1-3!** The S3 backend doesn't exist yet.

**Solution:** Do steps 1-3 first, THEN push to GitHub.

---

## 📖 Full Documentation

- `DEPLOYMENT_ORDER.md` - Complete step-by-step guide
- `docs/STATE_MANAGEMENT.md` - How state management works
- `terraform/bootstrap/README.md` - Bootstrap details

---

**Follow the order. It works.** ✅
