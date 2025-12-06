const https = require('https');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION });

// Get Tekmetric credentials from Secrets Manager
async function getTekmetricCredentials() {
  const command = new GetSecretValueCommand({
    SecretId: process.env.TEKMETRIC_SECRET_ARN
  });
  const response = await secretsClient.send(command);
  return JSON.parse(response.SecretString);
}

// Make HTTPS request helper
function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

// Get OAuth token from Tekmetric
async function getAccessToken(credentials) {
  console.log('🔐 Getting OAuth token from Tekmetric...');
  
  const basicAuth = Buffer.from(`${credentials.client_id}:${credentials.client_secret}`).toString('base64');
  const postData = 'grant_type=client_credentials';
  
  const options = {
    hostname: 'shop.tekmetric.com',
    path: '/api/v1/oauth/token',
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': postData.length
    }
  };
  
  const response = await makeRequest(options, postData);
  console.log('✅ Got access token');
  return response.access_token;
}

// Fetch repair orders from Tekmetric
async function fetchRepairOrders(accessToken, shopId) {
  console.log('📥 Fetching repair orders from Tekmetric...');
  
  // Get ROs from last 90 days that are Posted
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90);
  const startDateStr = startDate.toISOString().split('T')[0];
  
  const options = {
    hostname: 'shop.tekmetric.com',
    path: `/api/v1/repair-orders?shopId=${shopId}&postedStartDate=${startDateStr}&status=Posted`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  };
  
  const response = await makeRequest(options);
  console.log(`✅ Fetched ${response.content?.length || 0} repair orders`);
  return response.content || [];
}

// Fetch jobs for a specific RO
async function fetchROJobs(accessToken, shopId, roId) {
  const options = {
    hostname: 'shop.tekmetric.com',
    path: `/api/v1/repair-orders/${roId}/jobs?shopId=${shopId}`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  };
  
  const response = await makeRequest(options);
  return response.content || [];
}

// Extract unique job categories from jobs
function extractJobCategories(jobs) {
  const categories = new Set();
  jobs.forEach(job => {
    if (job.jobCategory) {
      categories.add(job.jobCategory);
    }
  });
  return Array.from(categories);
}

// Process and store RO in DynamoDB
async function processRepairOrder(ro, jobs) {
  // Separate declined and approved jobs
  const declinedJobs = jobs.filter(j => j.authorized === false);
  const approvedJobs = jobs.filter(j => j.authorized === true);
  
  // Skip if no declined jobs
  if (declinedJobs.length === 0) {
    return null;
  }
  
  // Calculate totals
  const declinedValue = declinedJobs.reduce((sum, job) => {
    const laborTotal = (job.laborHours || 0) * (job.laborRate || 0);
    const partsTotal = (job.parts || []).reduce((pSum, part) => pSum + (part.retail || 0) * (part.quantity || 1), 0);
    const feesTotal = (job.fees || []).reduce((fSum, fee) => fSum + (fee.amount || 0), 0);
    return sum + laborTotal + partsTotal + feesTotal;
  }, 0);
  
  const approvedValue = approvedJobs.reduce((sum, job) => {
    const laborTotal = (job.laborHours || 0) * (job.laborRate || 0);
    const partsTotal = (job.parts || []).reduce((pSum, part) => pSum + (part.retail || 0) * (part.quantity || 1), 0);
    const feesTotal = (job.fees || []).reduce((fSum, fee) => fSum + (fee.amount || 0), 0);
    return sum + laborTotal + partsTotal + feesTotal;
  }, 0);
  
  // Extract job categories
  const jobCategories = extractJobCategories(declinedJobs);
  
  // Build RO object for DynamoDB
  const roData = {
    ro_id: `RO_${ro.id}`,
    ro_number: ro.number || ro.id.toString(),
    tekmetric_ro_id: ro.id,
    status: 'FOLLOW_UP_BOARD', // New declined jobs start here
    customer_name: ro.customer?.name || 'Unknown',
    customer_phone: ro.customer?.phone || '',
    customer_email: ro.customer?.email || '',
    vehicle: {
      id: ro.vehicle?.id,
      year: ro.vehicle?.year,
      make: ro.vehicle?.make,
      model: ro.vehicle?.model,
      vin: ro.vehicle?.vin,
      mileage: ro.vehicle?.mileage
    },
    service_writer: ro.serviceWriter?.name || ro.createdBy?.name || 'Unknown',
    service_writer_id: ro.serviceWriter?.id || ro.createdBy?.id,
    posted_date: ro.postedDate || new Date().toISOString(),
    declined_jobs: declinedJobs.map(job => ({
      id: job.id,
      name: job.name,
      description: job.description || '',
      category: job.jobCategory || 'Other',
      labor_hours: job.laborHours || 0,
      labor_rate: job.laborRate || 0,
      labor_total: (job.laborHours || 0) * (job.laborRate || 0),
      parts: (job.parts || []).map(part => ({
        id: part.id,
        name: part.name,
        part_number: part.partNumber || '',
        quantity: part.quantity || 1,
        cost: part.cost || 0,
        retail: part.retail || 0,
        total: (part.retail || 0) * (part.quantity || 1)
      })),
      fees: (job.fees || []).map(fee => ({
        name: fee.name,
        amount: fee.amount || 0
      })),
      subtotal: (job.laborHours || 0) * (job.laborRate || 0) + 
                (job.parts || []).reduce((sum, p) => sum + (p.retail || 0) * (p.quantity || 1), 0) +
                (job.fees || []).reduce((sum, f) => sum + (f.amount || 0), 0),
      tax: job.tax || 0,
      total: job.total || 0
    })),
    approved_jobs: approvedJobs.map(job => ({
      id: job.id,
      name: job.name,
      total: job.total || 0
    })),
    declined_value: declinedValue,
    approved_value: approvedValue,
    close_ratio: approvedJobs.length > 0 ? 
      (approvedJobs.length / (approvedJobs.length + declinedJobs.length) * 100).toFixed(1) : '0.0',
    job_categories: jobCategories,
    reach_count: 0,
    contact_history: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60) // 90 days TTL
  };
  
  return roData;
}

// Main handler
exports.handler = async (event) => {
  console.log('🚀 Starting Tekmetric sync...');
  
  try {
    // Get credentials
    const credentials = await getTekmetricCredentials();
    const accessToken = await getAccessToken(credentials);
    
    // Fetch ROs
    const repairOrders = await fetchRepairOrders(accessToken, credentials.shop_id);
    console.log(`📊 Processing ${repairOrders.length} repair orders...`);
    
    let newROsCount = 0;
    let skippedCount = 0;
    
    for (const ro of repairOrders) {
      try {
        // Check if RO already exists in DynamoDB
        const existingRO = await docClient.send(new QueryCommand({
          TableName: process.env.REPAIR_ORDERS_TABLE,
          KeyConditionExpression: 'ro_id = :ro_id',
          ExpressionAttributeValues: {
            ':ro_id': `RO_${ro.id}`
          }
        }));
        
        if (existingRO.Items && existingRO.Items.length > 0) {
          skippedCount++;
          continue; // Already processed
        }
        
        // Fetch jobs for this RO
        const jobs = await fetchROJobs(accessToken, credentials.shop_id, ro.id);
        
        // Process and store
        const roData = await processRepairOrder(ro, jobs);
        
        if (roData) {
          await docClient.send(new PutCommand({
            TableName: process.env.REPAIR_ORDERS_TABLE,
            Item: roData
          }));
          newROsCount++;
        } else {
          skippedCount++; // No declined jobs
        }
        
        // Rate limiting - wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Error processing RO ${ro.id}:`, error);
      }
    }
    
    console.log(`✅ Sync complete: ${newROsCount} new ROs, ${skippedCount} skipped`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        newROsCount,
        skippedCount,
        totalProcessed: repairOrders.length
      })
    };
    
  } catch (error) {
    console.error('❌ Sync failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
