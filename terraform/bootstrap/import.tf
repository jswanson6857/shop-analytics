# Import existing bootstrap resources
import {
  to = aws_s3_bucket.terraform_state
  id = "revivecrm-terraform-state-095289934716"
}

import {
  to = aws_dynamodb_table.terraform_locks
  id = "revivecrm-terraform-locks"
}
