const https = require('https');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const secretsClient = new SecretsManagerClient({});

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
    console.log('🌐 Making request:', options.method, options.hostname + options.path);
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('📡 Response status:', res.statusCode);
        console.log('📡 Response headers:', JSON.stringify(res.headers, null, 2));
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (e) {
            console.log('📄 Raw response (not JSON):', data);
            resolve(data);
          }
        } else {
          console.error('❌ HTTP Error:', res.statusCode);
          console.error('❌ Response body:', data);
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Request error:', error.message);
      console.error('❌ Full error:', error);
      reject(error);
    });
    
    if (postData) {
      console.log('📤 POST data:', postData);
      req.write(postData);
    }
    req.end();
  });
}

// Get OAuth token from Tekmetric
async function getAccessToken(credentials) {
  console.log('🔐 Getting OAuth token from Tekmetric...');
  console.log('📋 Credentials:', { 
    client_id: credentials.client_id, 
    client_secret: credentials.client_secret ? '***' + credentials.client_secret.slice(-4) : 'MISSING',
    shop_id: credentials.shop_id
  });
  
  const basicAuth = Buffer.from(`${credentials.client_id}:${credentials.client_secret}`).toString('base64');
  const postData = 'grant_type=client_credentials';
  
  console.log('📤 Request to: https://shop.tekmetric.com/api/v1/oauth/token');
  console.log('📤 Auth header: Basic ' + basicAuth.substring(0, 20) + '...');
  
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
  
  try {
    const response = await makeRequest(options, postData);
    console.log('✅ Got access token:', response.access_token ? 'YES (length: ' + response.access_token.length + ')' : 'NO');
    console.log('📊 Token response:', JSON.stringify(response, null, 2));
    return response.access_token;
  } catch (error) {
    console.error('❌ OAuth failed:', error.message);
    console.error('❌ Full error:', error);
    throw error;
  }
}

// Fetch repair orders from Tekmetric
async function fetchRepairOrders(accessToken, shopId) {
  console.log('📥 Fetching repair orders from Tekmetric...');
  
  // Get ROs from last 90 days that are Posted (status ID 5)
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90);
  const startDateStr = startDate.toISOString().split('T')[0];
  
  console.log('📅 Date range: ' + startDateStr + ' to today');
  console.log('🏪 Shop ID: ' + shopId);
  console.log('📤 Request: GET /api/v1/repair-orders?shop=' + shopId + '&postedDateStart=' + startDateStr + '&repairOrderStatusId=5');
  
  const options = {
    hostname: 'shop.tekmetric.com',
    path: `/api/v1/repair-orders?shop=${shopId}&postedDateStart=${startDateStr}&repairOrderStatusId=5`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  };
  
  try {
    const response = await makeRequest(options);
    const count = response.content?.length || 0;
    console.log(`✅ Fetched ${count} repair orders from Tekmetric`);
    
    if (count === 0) {
      console.log('⚠️ WARNING: No repair orders found!');
      console.log('⚠️ This could mean:');
      console.log('   - No Posted ROs in last 90 days');
      console.log('   - Wrong shop ID');
      console.log('   - Wrong date format');
      console.log('📊 Full response:', JSON.stringify(response, null, 2));
    } else {
      console.log('📊 Sample RO:', JSON.stringify(response.content[0], null, 2));
    }
    
    return response.content || [];
  } catch (error) {
    console.error('❌ Fetch ROs failed:', error.message);
    console.error('❌ Full error:', error);
    throw error;
  }
}

// Fetch jobs for a specific RO
async function fetchROJobs(accessToken, shopId, roId) {
  const options = {
    hostname: 'shop.tekmetric.com',
    path: `/api/v1/jobs?shop=${shopId}&repairOrderId=${roId}`,
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
    if (job.jobCategoryName) {
      categories.add(job.jobCategoryName);
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
    const laborTotal = (job.labor || []).reduce((lSum, labor) => 
      lSum + ((labor.hours || 0) * (labor.rate || 0)), 0);
    const partsTotal = (job.parts || []).reduce((pSum, part) => 
      pSum + ((part.retail || 0) * (part.quantity || 1)), 0);
    const feesTotal = (job.fees || []).reduce((fSum, fee) => 
      fSum + (fee.total || 0), 0);
    return sum + laborTotal + partsTotal + feesTotal;
  }, 0);
  
  const approvedValue = approvedJobs.reduce((sum, job) => {
    const laborTotal = (job.labor || []).reduce((lSum, labor) => 
      lSum + ((labor.hours || 0) * (labor.rate || 0)), 0);
    const partsTotal = (job.parts || []).reduce((pSum, part) => 
      pSum + ((part.retail || 0) * (part.quantity || 1)), 0);
    const feesTotal = (job.fees || []).reduce((fSum, fee) => 
      fSum + (fee.total || 0), 0);
    return sum + laborTotal + partsTotal + feesTotal;
  }, 0);
  
  // Extract job categories
  const jobCategories = extractJobCategories(declinedJobs);
  
  // Build RO object for DynamoDB
  const roData = {
    ro_id: `RO_${ro.id}`,
    ro_number: ro.repairOrderNumber || ro.id.toString(),
    tekmetric_ro_id: ro.id,
    status: 'FOLLOW_UP_BOARD', // New declined jobs start here
    customer_name: ro.customer?.name || (ro.customer?.firstName && ro.customer?.lastName ? 
      `${ro.customer.firstName} ${ro.customer.lastName}` : 'Unknown'),
    customer_phone: ro.customer?.phone?.[0]?.number || ro.customer?.phone || '',
    customer_email: ro.customer?.email?.[0] || ro.customer?.email || '',
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
    declined_jobs: declinedJobs.map(job => {
      const laborArray = job.labor || [];
      const laborTotal = laborArray.reduce((sum, l) => sum + ((l.hours || 0) * (l.rate || 0)), 0);
      const partsArray = job.parts || [];
      const partsTotal = partsArray.reduce((sum, p) => sum + ((p.retail || 0) * (p.quantity || 1)), 0);
      const feesArray = job.fees || [];
      const feesTotal = feesArray.reduce((sum, f) => sum + (f.total || 0), 0);
      
      return {
        id: job.id,
        name: job.name,
        description: job.note || '',
        category: job.jobCategoryName || 'Other',
        labor: laborArray.map(l => ({
          name: l.name,
          hours: l.hours || 0,
          rate: l.rate || 0,
          total: (l.hours || 0) * (l.rate || 0)
        })),
        labor_total: laborTotal,
        parts: partsArray.map(part => ({
          id: part.id,
          name: part.name,
          part_number: part.partNumber || '',
          quantity: part.quantity || 1,
          cost: part.cost || 0,
          retail: part.retail || 0,
          total: (part.retail || 0) * (part.quantity || 1)
        })),
        parts_total: partsTotal,
        fees: feesArray.map(fee => ({
          name: fee.name,
          total: fee.total || 0
        })),
        fees_total: feesTotal,
        subtotal: laborTotal + partsTotal + feesTotal,
        total: job.subtotal || (laborTotal + partsTotal + feesTotal)
      };
    }),
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
  console.log('📋 Event:', JSON.stringify(event, null, 2));
  console.log('🔧 Environment:', {
    REPAIR_ORDERS_TABLE: process.env.REPAIR_ORDERS_TABLE,
    TEKMETRIC_SECRET_ARN: process.env.TEKMETRIC_SECRET_ARN
  });
  
  try {
    // Get credentials
    console.log('📦 Getting credentials from Secrets Manager...');
    const credentials = await getTekmetricCredentials();
    console.log('✅ Credentials loaded');
    
    const accessToken = await getAccessToken(credentials);
    console.log('✅ Access token obtained');
    
    // Fetch ROs
    const repairOrders = await fetchRepairOrders(accessToken, credentials.shop_id);
    console.log(`📊 Processing ${repairOrders.length} repair orders...`);
    
    if (repairOrders.length === 0) {
      console.log('⚠️ NO REPAIR ORDERS TO PROCESS');
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'No repair orders found in Tekmetric for the last 90 days',
          newROsCount: 0,
          skippedCount: 0,
          totalProcessed: 0
        })
      };
    }
    
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
