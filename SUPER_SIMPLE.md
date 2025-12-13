# ⚡ SUPER SIMPLE DEPLOYMENT

## Step 1: Add 3 Secrets

Go to: **Settings → Secrets → Actions**

Add these 3:
- `TEKMETRIC_CLIENT_ID` = `b9ac67f0337844a6`
- `TEKMETRIC_CLIENT_SECRET` = `f4e9c0c039534a1696f7a12c`
- `TEKMETRIC_SHOP_ID` = `3389259`

(You already have AWS and Okta secrets ✅)

---

## Step 2: Run Bootstrap (One Time)

1. Go to **Actions** tab
2. Click **Bootstrap State Infrastructure** (left side)
3. Click **Run workflow** button (right side)
4. Click green **Run workflow** button
5. Wait 1 minute

**It will automatically:**
- Create S3 bucket
- Update main.tf
- Enable auto-deploy
- Commit changes

---

## Step 3: That's It!

After bootstrap completes, every push auto-deploys!

```bash
git push
```

**No more manual workflows. Just push code.** ✅

---

## ⚠️ Important

**Don't push before running bootstrap!**

Bootstrap must run FIRST to:
1. Create the S3 bucket
2. Update the bucket name in code
3. Enable auto-deploy

**Order:**
1. Bootstrap workflow (one-time click)
2. Then push code (auto-deploys forever)

---

**Run bootstrap first, then you're done!** 🚀
