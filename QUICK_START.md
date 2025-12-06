# 🚀 ReviveCRM - Quick Reference Card

## ⚡ What I Need from You

### 1️⃣ **Get Your AWS Credentials**
```bash
# If you don't have an IAM user for CI/CD yet:
# 1. Go to AWS Console → IAM
# 2. Create new user: "github-actions-revivecrm"
# 3. Attach policy: AdministratorAccess (or custom policy from GITHUB_SECRETS.md)
# 4. Create access key
# 5. Save the Access Key ID and Secret Access Key
```

### 2️⃣ **Get Your Terraform Cloud Token**
```
1. Go to: https://app.terraform.io/app/settings/tokens
2. Click "Create an API token"
3. Name it: "github-actions-revivecrm"
4. Copy the token (starts with "xxxxxxxxxxxxxx.atlasv1...")
```

### 3️⃣ **Add GitHub Secrets**

Go to your repo: `Settings` → `Secrets and variables` → `Actions`

Add these **8 secrets**:

| Secret Name | Where to Get It | Example/Value |
|-------------|-----------------|---------------|
| `AWS_ACCESS_KEY_ID` | AWS IAM Console | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM Console | `wJalrXUtnFEMI/K7MDENG...` |
| `TF_API_TOKEN` | Terraform Cloud | `xxxxx.atlasv1.zzzzz...` |
| `TEKMETRIC_CLIENT_ID` | ✅ Already have | `b9ac67f0337844a6` |
| `TEKMETRIC_CLIENT_SECRET` | ✅ Already have | `f4e9c0c039534a1696f7a12c` |
| `TEKMETRIC_SHOP_ID` | ✅ Already have | `3389259` |
| `AUTH0_DOMAIN` | ✅ Already have | `dev-fugvz4vli76oqpqw.us.auth0.com` |
| `AUTH0_CLIENT_ID` | ✅ Already have | `8OMklLM4zv5GsVZ8laNPOZK97IDDxoQP` |

---

## 🎯 Then Just Push!

```bash
git init
git add .
git commit -m "Initial ReviveCRM deployment"
git remote add origin <your-github-repo-url>
git push -u origin main
```

**That's it!** GitHub Actions will:
1. ✅ Deploy infrastructure to AWS
2. ✅ Build and deploy frontend to CloudFront
3. ✅ Give you the application URL

---

## 📋 Three Files You Need to Know

1. **`SETUP.md`** - Complete deployment guide
2. **`docs/GITHUB_SECRETS.md`** - Detailed secrets setup
3. **`.github/workflows/deploy.yml`** - The automation workflow

---

## 🔄 Workflow Summary

**File:** `.github/workflows/deploy.yml`

**What it does:**
- Runs on push to `main` branch
- Deploys Terraform infrastructure
- Builds React frontend
- Deploys to S3 + CloudFront
- Outputs your application URL

**Variables it needs:**
- All 8 GitHub secrets (listed above)

**What it outputs:**
- API Gateway URL
- CloudFront URL (your app!)
- S3 bucket name
- CloudFront distribution ID

---

## 🆘 If Something Goes Wrong

### Workflow fails at "Terraform Init"
**Problem:** Terraform Cloud token is wrong

**Fix:**
1. Go to https://app.terraform.io/app/settings/tokens
2. Generate new token
3. Update `TF_API_TOKEN` secret in GitHub

### Workflow fails at "Terraform Apply"
**Problem:** AWS credentials are wrong or lack permissions

**Fix:**
1. Verify AWS access key is correct
2. Check IAM user has admin permissions (or use policy from `docs/GITHUB_SECRETS.md`)
3. Update GitHub secrets

### Workflow fails at "Deploy to S3"
**Problem:** S3 bucket wasn't created or AWS credentials don't work

**Fix:**
1. Check previous Terraform step succeeded
2. Verify AWS credentials work: `aws sts get-caller-identity`
3. Re-run workflow

### Frontend shows errors locally
**This is expected!** You need to deploy first, then:

```bash
cd frontend
echo "REACT_APP_API_URL=<your-api-gateway-url>" > .env.local
echo "REACT_APP_AUTH0_DOMAIN=dev-fugvz4vli76oqpqw.us.auth0.com" >> .env.local
echo "REACT_APP_AUTH0_CLIENT_ID=8OMklLM4zv5GsVZ8laNPOZK97IDDxoQP" >> .env.local
npm start
```

---

## ✅ Success Checklist

Before pushing:
- [ ] Downloaded and extracted the zip
- [ ] Created GitHub repository
- [ ] Added all 8 GitHub secrets
- [ ] Verified Terraform Cloud token works
- [ ] Verified AWS credentials work

After pushing:
- [ ] Workflow runs without errors
- [ ] Can access CloudFront URL
- [ ] Can login with Auth0
- [ ] Can see Follow Up Board
- [ ] No console errors

---

## 🎉 You're Done When...

You can:
1. ✅ Open CloudFront URL in browser
2. ✅ Click "Log In" with Auth0
3. ✅ See Follow Up Board (even if empty)
4. ✅ Navigate between all 4 tabs
5. ✅ No errors in browser console

---

## 📞 Quick Commands

**Check AWS credentials work:**
```bash
aws sts get-caller-identity
```

**Add all GitHub secrets at once (requires GitHub CLI):**
```bash
gh secret set AWS_ACCESS_KEY_ID
gh secret set AWS_SECRET_ACCESS_KEY
gh secret set TF_API_TOKEN
gh secret set TEKMETRIC_CLIENT_ID --body "b9ac67f0337844a6"
gh secret set TEKMETRIC_CLIENT_SECRET --body "f4e9c0c039534a1696f7a12c"
gh secret set TEKMETRIC_SHOP_ID --body "3389259"
gh secret set AUTH0_DOMAIN --body "dev-fugvz4vli76oqpqw.us.auth0.com"
gh secret set AUTH0_CLIENT_ID --body "8OMklLM4zv5GsVZ8laNPOZK97IDDxoQP"
```

**Watch deployment:**
```bash
# After pushing
gh run watch
```

---

## 🎯 Bottom Line

**You need:**
1. AWS access key + secret
2. Terraform Cloud token
3. 5 minutes to add GitHub secrets

**You get:**
- Complete callback management system
- Deployed to AWS
- Live on CloudFront
- Automated deployments forever

**Ready? Let's deploy!** 🚀
