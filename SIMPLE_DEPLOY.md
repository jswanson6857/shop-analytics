# 🚀 Simple Deployment Guide

## Step 1: Bootstrap (Creates S3 Bucket)

```bash
cd terraform/bootstrap
terraform init
terraform apply
```

**When it finishes, you'll see:**

```
Outputs:

state_bucket_name = "revivecrm-terraform-state-123456789012"
```

**COPY that bucket name!** (the part in quotes)

---

## Step 2: Update main.tf

Open: `terraform/environments/prod/main.tf`

Find line 23:
```hcl
bucket = "BUCKET_NAME_FROM_BOOTSTRAP"
```

Replace with YOUR bucket name from Step 1:
```hcl
bucket = "revivecrm-terraform-state-123456789012"
```

Save the file.

---

## Step 3: Add GitHub Secrets

Go to your GitHub repo:
**Settings → Secrets and variables → Actions → New repository secret**

Add these 7 secrets:

1. `AWS_ACCESS_KEY_ID` = (your AWS access key)
2. `AWS_SECRET_ACCESS_KEY` = (your AWS secret key)
3. `TEKMETRIC_CLIENT_ID` = `b9ac67f0337844a6`
4. `TEKMETRIC_CLIENT_SECRET` = `f4e9c0c039534a1696f7a12c`
5. `TEKMETRIC_SHOP_ID` = `3389259`
6. `AUTH0_DOMAIN` = `dev-fugvz4vli76oqpqw.us.auth0.com`
7. `AUTH0_CLIENT_ID` = `8OMklLM4zv5GsVZ8laNPOZK97IDDxoQP`

---

## Step 4: Deploy!

```bash
git add .
git commit -m "Deploy ReviveCRM"
git push origin main
```

**Go to GitHub → Actions tab → Watch it deploy!**

---

## ✅ Success!

When deployment finishes, GitHub Actions will show:

```
Outputs:

api_gateway_url = "https://abc123.execute-api.us-east-1.amazonaws.com/prod"
cloudfront_url = "https://d1234567890.cloudfront.net"
```

**Open the CloudFront URL - your app is live!**

---

## 🔄 Deploy Again (Anytime)

Make changes to your code, then:

```bash
git add .
git commit -m "My changes"
git push origin main
```

**Terraform will:**
- ✅ Read state from S3
- ✅ See what exists
- ✅ Only update what changed
- ✅ **NO DUPLICATES!**

---

## 🆘 If You Already Have Resources

The `import.tf` file will automatically import them. Just push!

---

**That's it. 4 steps. Then deploy forever.** ✅
