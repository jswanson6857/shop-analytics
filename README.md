# ReviveCRM - Tekmetric Callback Management System

**Production-ready callback management with Tekmetric integration, automated workflows, and real-time analytics.**

[![Deploy Infrastructure](https://github.com/yourusername/revivecrm/actions/workflows/terraform-deploy.yml/badge.svg)](https://github.com/yourusername/revivecrm/actions/workflows/terraform-deploy.yml)
[![Deploy Frontend](https://github.com/yourusername/revivecrm/actions/workflows/frontend-deploy.yml/badge.svg)](https://github.com/yourusername/revivecrm/actions/workflows/frontend-deploy.yml)

---

## 🚀 Quick Start

```bash
# 1. Extract and enter directory
cd revivecrm-production

# 2. Deploy everything (one command!)
./deploy.sh

# 3. Your app is live on CloudFront!
```

**Deployment time:** ~5 minutes  
**Monthly AWS cost:** ~$20-25

---

## ✨ What You Get

### Complete Backend Infrastructure
- ✅ 7 AWS Lambda functions with full business logic
- ✅ 6 DynamoDB tables
- ✅ API Gateway REST API with CORS
- ✅ EventBridge automation (daily/hourly)
- ✅ Secrets Manager for credentials
- ✅ IAM roles with least privilege

### Full-Featured Frontend
- ✅ React 18 SPA with 8 components
- ✅ Auth0 authentication
- ✅ S3 + CloudFront hosting (HTTPS)
- ✅ Responsive Tekmetric-style UI
- ✅ Real-time data updates

### CI/CD Pipelines
- ✅ GitHub Actions workflows
- ✅ Automated infrastructure deployment
- ✅ Automated frontend deployment
- ✅ No manual steps required

---

## 📋 Features

### Follow Up Board
- Job categories grid (dynamically extracted from Tekmetric)
- Repair orders table with filters
- Click-to-open RO detail modal

### RO Detail Modal (600+ lines)
- Per-job interest tracking
- Labor/Parts/Fees breakdown with correct decimals
- Approved jobs display
- Contact method selection (Call/Voicemail/Text)
- Activity Feed with timestamped history
- User assignment and follow-up scheduling
- Full validation logic

### Follow Up Tracker
- Reach count tracking (1st, 2nd, 3+)
- User avatars with initials
- Interested/Not Interested counts
- Follow-up dates with overdue indicators

### Appointment Tracker
- Scheduled appointments from Tekmetric
- Auto-verification (detects customer show-ups)
- Status tracking (Pending/Completed/No Show)

### Return Sales Tracker
- Real-time analytics calculations
- Outbound calls breakdown
- Direct/Indirect sales revenue
- Sales by job category
- Filter by user and date range

### Automation
- Daily Tekmetric sync (4 AM)
- Hourly appointment verification
- Daily sales tracking (midnight)
- Auto-cleanup with DynamoDB TTL

---

## 🏗️ Architecture

```
Tekmetric API ─────> EventBridge ─────> Lambda Functions ─────> DynamoDB
                         ↓                      ↓                    ↓
                    Scheduled                REST                  Data
                     (Daily)               API Gateway            Storage
                                               ↓                    ↓
                                         React Frontend    ←── Queries ──
                                               ↓
                                    S3 + CloudFront (HTTPS)
```

**Tech Stack:**
- Backend: AWS Lambda (Node.js 18), DynamoDB, API Gateway
- Frontend: React 18, Auth0, S3 + CloudFront
- Infrastructure: Terraform, GitHub Actions
- Integration: Tekmetric API

---

## 📁 Project Structure

```
revivecrm-production/
├── START_HERE.md              # 👈 Begin here!
├── SETUP.md                   # Complete setup guide
├── deploy.sh                  # One-command deployment
├── .github/workflows/         # CI/CD pipelines
├── terraform/
│   ├── modules/
│   │   ├── backend/           # Lambda, DynamoDB, API Gateway
│   │   └── frontend/          # S3 + CloudFront
│   └── environments/prod/     # Production config
├── lambdas/                   # 7 Lambda functions
├── frontend/                  # React application
└── docs/                      # Documentation
```

---

## 🎯 Deployment Options

### Option 1: Local Deployment (Fastest)
```bash
./deploy.sh
```
Perfect for first-time setup.

### Option 2: GitHub Actions (CI/CD)
```bash
git push origin main
```
Automated deployments on every push.

See [SETUP.md](./SETUP.md) for detailed instructions.

---

## 🔧 Configuration

### Prerequisites
- AWS account with credentials
- Node.js 18+
- Terraform 1.0+
- AWS CLI

### Already Configured
- ✅ Tekmetric credentials
- ✅ Auth0 authentication  
- ✅ All infrastructure code
- ✅ All application code

Just run `./deploy.sh` and you're live!

---

## 📊 Business Logic

### Status Routing Hierarchy
```
Appointment Made > Interested > Not Interested/Work Completed
```

Multi-job RO handling:
- If ANY job = "Appointment Made" → Appointment Tracker
- If NO appointments but has "Interested" → Follow Up Tracker
- If ALL jobs = "Not Interested/Completed" → Deleted

### Reach Count Tracking
- 1st reach, 2nd reach, 3+ reach
- Only counts actual calls (not voicemail/text)
- Used for analytics and display

### Appointment Verification (Automated)
- Runs hourly via EventBridge
- Checks for new RO with matching vehicleId
- Within 24 hours of appointment end
- Auto-updates status (Completed/No Show)

### Direct/Indirect Sales (Automated)
- Runs daily at midnight
- Finds completed work by vehicleId + job name
- **Direct:** Followed-up job completed
- **Indirect:** Additional work beyond follow-up
- Calculates revenue and stores in DynamoDB

---

## 💰 Cost Breakdown

**AWS Monthly (low usage):**
| Service | Cost |
|---------|------|
| Lambda | ~$5 |
| DynamoDB | ~$10 |
| API Gateway | ~$3 |
| S3 + CloudFront | ~$2 |
| Secrets Manager | ~$1 |
| **Total** | **~$20-25** |

Scales automatically with usage (pay-per-use).

---

## 📚 Documentation

- **[START_HERE.md](./START_HERE.md)** - Quick start guide
- **[SETUP.md](./SETUP.md)** - Complete setup instructions
- **[FILE_STRUCTURE.md](./FILE_STRUCTURE.md)** - Project structure
- **[docs/DEPLOYMENT_GUIDE.md](./docs/DEPLOYMENT_GUIDE.md)** - Detailed deployment
- **[docs/FINAL_BUILD_SUMMARY.md](./docs/FINAL_BUILD_SUMMARY.md)** - Feature summary

---

## 🧪 Testing

### Test API Endpoints
```bash
API_URL=$(cd terraform/environments/prod && terraform output -raw api_gateway_url)
curl "$API_URL/users"
curl "$API_URL/ros?status=FOLLOW_UP_BOARD"
```

### Test Frontend Locally
```bash
cd frontend
npm install
npm start
# Opens http://localhost:3000
```

---

## 📈 Monitoring

### CloudWatch Logs
```bash
# View Lambda logs
aws logs tail /aws/lambda/revivecrm-sync-tekmetric-production --follow
```

### DynamoDB Tables
```bash
# Scan repair orders
aws dynamodb scan --table-name revivecrm-repair-orders-production
```

---

## 🔄 Making Updates

### Update Frontend
```bash
cd frontend
# Make changes...
npm run build
npm run deploy
```

### Update Backend
```bash
# Make changes to Terraform or Lambdas
./deploy.sh
```

### Or Push to GitHub (CI/CD)
```bash
git add .
git commit -m "Update"
git push origin main
```

---

## 🚨 Troubleshooting

| Issue | Solution |
|-------|----------|
| Permission denied | `chmod +x deploy.sh` |
| Terraform backend error | Configure backend in `terraform/environments/prod/main.tf` |
| CloudFront 404 | Wait 15-20 minutes for distribution creation |
| CORS error | Check API Gateway CORS in Terraform |
| Lambda timeout | Increase timeout in `lambda.tf` |

See [SETUP.md](./SETUP.md) for more troubleshooting.

---

## 🎓 What You'll Learn

This codebase demonstrates:
- **Terraform**: Modular infrastructure, state management
- **AWS Lambda**: Serverless functions, DynamoDB integration
- **React**: Component architecture, Auth0 integration
- **CI/CD**: GitHub Actions, automated deployments
- **API Design**: REST API, CORS, validation

---

## 📞 Support

1. Check [SETUP.md](./SETUP.md)
2. Review CloudWatch logs
3. Check GitHub Actions logs
4. Verify AWS credentials

---

## 🎉 Ready to Deploy?

```bash
./deploy.sh
```

Your production-ready callback management system will be live in ~5 minutes!

---

## 📝 License

Proprietary - All rights reserved

---

**Built with ❤️ for automotive service shops using Tekmetric**

Start transforming your callback process today! 🚀
