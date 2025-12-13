# 🚀 Deploy ReviveCRM - Quick Start

## ⚡ 4 Steps to Deploy

### Step 1: Bootstrap
```bash
cd terraform/bootstrap
terraform init
terraform apply
terraform output -raw state_bucket_name
# Copy the bucket name!
```

### Step 2: Update Bucket Name
```bash
# Edit: terraform/environments/prod/main.tf (line 23)
# Replace: bucket = "BUCKET_NAME_FROM_BOOTSTRAP"
# With: bucket = "revivecrm-terraform-state-YOUR-ACCOUNT-ID"
```

### Step 3: Add GitHub Secrets
7 secrets required (see list below)

### Step 4: Deploy
```bash
git add .
git commit -m "Deploy ReviveCRM"
git push origin main
```

**Done! Deploy as many times as you want - no duplicates!**

---

## 🔑 GitHub Secrets (7 Required)

| Secret | Value |
|--------|-------|
| AWS_ACCESS_KEY_ID | Your key |
| AWS_SECRET_ACCESS_KEY | Your secret |
| TEKMETRIC_CLIENT_ID | b9ac67f0337844a6 |
| TEKMETRIC_CLIENT_SECRET | f4e9c0c039534a1696f7a12c |
| TEKMETRIC_SHOP_ID | 3389259 |
| AUTH0_DOMAIN | dev-fugvz4vli76oqpqw.us.auth0.com |
| AUTH0_CLIENT_ID | 8OMklLM4zv5GsVZ8laNPOZK97IDDxoQP |

---

## 🔐 How State Tracking Works

**After you update the bucket name:**
- ✅ Every deploy reads state from S3
- ✅ Terraform knows what exists
- ✅ Only creates/updates what changed
- ✅ **NEVER creates duplicates!**

**State file location:**
```
s3://revivecrm-terraform-state-123456789012/production/terraform.tfstate
```

---

## 🆘 Troubleshooting

**"Resources already exist"**
→ You deployed before updating bucket name
→ Run: `bash cleanup-aws.sh` then redeploy

**"Backend initialization required"**
→ Update bucket name in main.tf first

**"Access Denied"**
→ Check AWS credentials in GitHub Secrets

---

## ✅ Success Checklist

- [ ] Ran bootstrap
- [ ] Updated bucket name in main.tf
- [ ] Added all 7 GitHub secrets
- [ ] Pushed to main branch
- [ ] GitHub Actions completed successfully
- [ ] CloudFront URL in Actions output

---

**Read DEPLOYMENT_ORDER.md for detailed explanation!**
