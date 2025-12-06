# 🔐 GitHub Secrets Configuration Guide

## Required Secrets for CI/CD

You need to add these secrets to your GitHub repository before the workflows will work.

---

## 📍 Where to Add Secrets

1. Go to your GitHub repository
2. Click **Settings**
3. Click **Secrets and variables** → **Actions**
4. Click **New repository secret**

---

## 🔑 Secrets to Add

### 1. AWS Credentials

**`AWS_ACCESS_KEY_ID`**
- Your AWS access key ID
- Get from: AWS IAM Console
- Example: `AKIAIOSFODNN7EXAMPLE`

**`AWS_SECRET_ACCESS_KEY`**
- Your AWS secret access key
- Get from: AWS IAM Console
- Example: `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`

### 2. Terraform Cloud

**`TF_API_TOKEN`**
- Your Terraform Cloud API token
- Get from: https://app.terraform.io/app/settings/tokens
- Example: `xxxxxxxxxxxxxx.atlasv1.zzzzzzzzzzzzzzzzz`

### 3. Tekmetric API

**`TEKMETRIC_CLIENT_ID`**
- Value: `b9ac67f0337844a6`

**`TEKMETRIC_CLIENT_SECRET`**
- Value: `f4e9c0c039534a1696f7a12c`

**`TEKMETRIC_SHOP_ID`**
- Value: `3389259`

### 4. Auth0

**`AUTH0_DOMAIN`**
- Value: `dev-fugvz4vli76oqpqw.us.auth0.com`

**`AUTH0_CLIENT_ID`**
- Value: `8OMklLM4zv5GsVZ8laNPOZK97IDDxoQP`

---

## ✅ Complete Secrets Checklist

Copy-paste this checklist and check off as you add each secret:

```
AWS Credentials:
[ ] AWS_ACCESS_KEY_ID
[ ] AWS_SECRET_ACCESS_KEY

Terraform:
[ ] TF_API_TOKEN

Tekmetric:
[ ] TEKMETRIC_CLIENT_ID = b9ac67f0337844a6
[ ] TEKMETRIC_CLIENT_SECRET = f4e9c0c039534a1696f7a12c
[ ] TEKMETRIC_SHOP_ID = 3389259

Auth0:
[ ] AUTH0_DOMAIN = dev-fugvz4vli76oqpqw.us.auth0.com
[ ] AUTH0_CLIENT_ID = 8OMklLM4zv5GsVZ8laNPOZK97IDDxoQP
```

---

## 🎯 Quick Add Commands

You can also use GitHub CLI to add secrets:

```bash
# AWS
gh secret set AWS_ACCESS_KEY_ID
gh secret set AWS_SECRET_ACCESS_KEY

# Terraform
gh secret set TF_API_TOKEN

# Tekmetric
gh secret set TEKMETRIC_CLIENT_ID --body "b9ac67f0337844a6"
gh secret set TEKMETRIC_CLIENT_SECRET --body "f4e9c0c039534a1696f7a12c"
gh secret set TEKMETRIC_SHOP_ID --body "3389259"

# Auth0
gh secret set AUTH0_DOMAIN --body "dev-fugvz4vli76oqpqw.us.auth0.com"
gh secret set AUTH0_CLIENT_ID --body "8OMklLM4zv5GsVZ8laNPOZK97IDDxoQP"
```

---

## 🚀 Testing Secrets

After adding all secrets, test by:

1. Push a small change to `main` branch
2. Go to **Actions** tab
3. Watch the workflow run
4. All secrets should be available

---

## 🔒 Security Notes

- ✅ These secrets are encrypted by GitHub
- ✅ They're only available during workflow runs
- ✅ They're never exposed in logs
- ✅ Only repo admins can view/edit them

---

## 🆘 Troubleshooting

### "Secret not found" error

**Problem:** Workflow fails with "secret not found"

**Solution:**
1. Check secret name spelling (case-sensitive!)
2. Verify secret is added at repository level (not organization)
3. Make sure you committed and pushed the workflow file

### "AWS credentials not working"

**Problem:** Terraform fails to authenticate with AWS

**Solution:**
1. Verify `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are correct
2. Check IAM user has proper permissions:
   - Lambda
   - DynamoDB
   - API Gateway
   - S3
   - CloudFront
   - IAM (for role creation)
   - EventBridge
   - Secrets Manager

### "Terraform Cloud authentication failed"

**Problem:** `terraform init` fails

**Solution:**
1. Verify `TF_API_TOKEN` is correct
2. Check Terraform Cloud workspace name in `main.tf` matches your organization
3. Make sure workspace exists in Terraform Cloud

---

## 📋 AWS IAM Policy (for CI/CD user)

Your AWS access key needs these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "lambda:*",
        "dynamodb:*",
        "apigateway:*",
        "s3:*",
        "cloudfront:*",
        "iam:*",
        "events:*",
        "secretsmanager:*",
        "logs:*"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## ✨ After Adding Secrets

Once all secrets are added:

1. ✅ Push to main branch
2. ✅ Workflow runs automatically
3. ✅ Infrastructure deploys to AWS
4. ✅ Frontend deploys to CloudFront
5. ✅ Application is live!

---

## 📞 Need Help?

- GitHub Secrets Docs: https://docs.github.com/en/actions/security-guides/encrypted-secrets
- Terraform Cloud Tokens: https://app.terraform.io/app/settings/tokens
- AWS IAM: https://console.aws.amazon.com/iam/
