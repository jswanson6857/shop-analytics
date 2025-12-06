# 🔐 Terraform State Infrastructure Bootstrap

This directory contains Terraform configuration to create the **S3 bucket** and **DynamoDB table** needed for remote state management.

## 🎯 Purpose

**Prevents duplicate AWS resources** when deploying multiple times by:
- Storing Terraform state remotely in S3 (shared across all deployments)
- Locking state during operations with DynamoDB (prevents concurrent modifications)

## ⚡ Quick Start

```bash
# From project root
bash bootstrap-state.sh
```

That's it! The script will:
1. Run `terraform apply` in this directory
2. Create S3 bucket and DynamoDB table
3. Automatically update your main.tf with the bucket name

## 📋 What Gets Created

### S3 Bucket
- **Name**: `revivecrm-terraform-state-YOUR-ACCOUNT-ID`
- **Purpose**: Stores terraform.tfstate file
- **Features**: Versioning enabled, encrypted, private
- **Cost**: ~$0.10/month

### DynamoDB Table
- **Name**: `revivecrm-terraform-locks`
- **Purpose**: State locking (prevents concurrent applies)
- **Billing**: Pay-per-request
- **Cost**: ~$0.01/month

## 🔧 Manual Setup (if script doesn't work)

```bash
# 1. Navigate to bootstrap directory
cd terraform/bootstrap

# 2. Initialize Terraform
terraform init

# 3. Review what will be created
terraform plan

# 4. Create the infrastructure
terraform apply

# 5. Get the bucket name
terraform output state_bucket_name

# 6. Update main.tf with the bucket name
cd ../../
sed -i 's/revivecrm-terraform-state-YOUR-UNIQUE-ID/YOUR-ACTUAL-BUCKET-NAME/g' terraform/environments/prod/main.tf
```

## 📖 Files in This Directory

- **main.tf** - Terraform configuration for S3 bucket and DynamoDB table
- **bootstrap.tfstate** - Local state file for bootstrap resources
- **.terraform/** - Terraform plugins (created after init)

## ✅ Verification

After running, verify the resources exist:

```bash
# Check S3 bucket
terraform output state_bucket_name

# Check DynamoDB table
terraform output lock_table_name

# View all outputs
terraform output
```

## 🔄 State Management

**Important**: This bootstrap uses a **local backend** (`bootstrap.tfstate`).

Once you create these resources, your main infrastructure will use the **S3 backend** to store its state.

```
Bootstrap (this)     → Local state (bootstrap.tfstate)
Main Infrastructure  → S3 state (uses bucket created here)
```

## ⚠️ Important Notes

### Only Run Once
You only need to run this **one time** per AWS account/region.

### Don't Delete
The resources created here have `prevent_destroy = true` to avoid accidental deletion.

If you need to destroy them:
```bash
terraform destroy -target=aws_s3_bucket.terraform_state
terraform destroy -target=aws_dynamodb_table.terraform_locks
```

### Keep bootstrap.tfstate Safe
This local state file tracks the bootstrap resources. Keep it in source control or back it up.

## 🆘 Troubleshooting

### "Bucket name already exists"
Someone else used that bucket name. Either:
- Use the existing bucket (if it's yours)
- Change the project name in main.tf

### "Cannot create table"
The table might already exist. Check:
```bash
aws dynamodb describe-table --table-name revivecrm-terraform-locks
```

### "Access Denied"
Your AWS credentials need these permissions:
- `s3:CreateBucket`
- `s3:PutBucketVersioning`
- `s3:PutEncryptionConfiguration`
- `dynamodb:CreateTable`

## 📚 Learn More

See `../docs/STATE_MANAGEMENT.md` for complete documentation on:
- How state locking prevents duplicates
- Why remote state is important
- Security considerations
- Best practices

## ✨ After Bootstrap

Once this completes, you can deploy your main infrastructure with confidence:

```bash
cd ../..
git add .
git commit -m "Configure state backend"
git push origin main
```

**No duplicate resources will be created!** 🎉
