const https = require('https');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION });

async function getTekmetricCredentials() {
  const command = new GetSecretValueCommand({
    SecretId: process.env.TEKMETRIC_SECRET_ARN
  });
  const response = await secretsClient.send(command);
  return JSON.parse(response.SecretString);
}

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
    if (postData) req.write(postData);
    req.end();
  });
}

async function getAccessToken(credentials) {
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
  return response.access_token;
}

// Fetch recent ROs for a vehicle
async function fetchVehicleROs(accessToken, shopId, vehicleId, startDate) {
  const options = {
    hostname: 'shop.tekmetric.com',
    path: `/api/v1/repair-orders?shopId=${shopId}&vehicleId=${vehicleId}&postedStartDate=${startDate}&status=Posted`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  };
  
  const response = await makeRequest(options);
  return response.content || [];
}

// Fetch jobs for an RO
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

exports.handler = async (event) => {
  console.log('💰 Starting sales tracking batch job...');
  
  try {
    const credentials = await getTekmetricCredentials();
    const accessToken = await getAccessToken(credentials);
    
    // Fetch all ROs that were contacted through our app
    const rosResult = await docClient.send(new ScanCommand({
      TableName: process.env.REPAIR_ORDERS_TABLE
    }));
    const ros = rosResult.Items || [];
    
    // Filter to ROs that have contact history
    const contactedROs = ros.filter(ro => 
      (ro.contact_history || []).length > 0
    );
    
    console.log(`Processing ${contactedROs.length} contacted ROs...`);
    
    let directSalesCount = 0;
    let indirectSalesCount = 0;
    let totalDirectRevenue = 0;
    let totalIndirectRevenue = 0;
    
    for (const ro of contactedROs) {
      const vehicleId = ro.vehicle?.id;
      if (!vehicleId) continue;
      
      // Check if we've already processed this RO
      const existingTracking = await docClient.send(new QueryCommand({
        TableName: process.env.SALES_TRACKING_TABLE,
        IndexName: 'VehicleIndex',
        KeyConditionExpression: 'vehicle_id = :vehicle_id',
        FilterExpression: 'ro_id = :ro_id',
        ExpressionAttributeValues: {
          ':vehicle_id': vehicleId,
          ':ro_id': ro.ro_id
        }
      }));
      
      if (existingTracking.Items && existingTracking.Items.length > 0) {
        continue; // Already tracked
      }
      
      // Look for new ROs for this vehicle since our contact
      const lastContactDate = ro.last_contact_date || ro.updated_at;
      const checkDate = new Date(lastContactDate);
      checkDate.setDate(checkDate.getDate() - 1); // Start from day before contact
      
      const newROs = await fetchVehicleROs(
        accessToken,
        credentials.shop_id,
        vehicleId,
        checkDate.toISOString().split('T')[0]
      );
      
      // Filter to ROs after our contact that aren't the original RO
      const completedROs = newROs.filter(newRO => 
        newRO.id !== ro.tekmetric_ro_id &&
        new Date(newRO.postedDate) > new Date(lastContactDate) &&
        newRO.status === 'Posted'
      );
      
      if (completedROs.length === 0) {
        continue; // No completed work yet
      }
      
      // Check each declined job to see if it was completed
      for (const declinedJob of (ro.declined_jobs || [])) {
        for (const completedRO of completedROs) {
          const completedJobs = await fetchROJobs(
            accessToken,
            credentials.shop_id,
            completedRO.id
          );
          
          // DIRECT SALES: Find matching job by name
          const matchingJob = completedJobs.find(j => 
            j.name === declinedJob.name && j.authorized === true
          );
          
          if (matchingJob) {
            // Calculate revenue
            const revenue = (matchingJob.laborHours || 0) * (matchingJob.laborRate || 0) +
                          (matchingJob.parts || []).reduce((sum, p) => sum + (p.retail || 0) * (p.quantity || 1), 0) +
                          (matchingJob.fees || []).reduce((sum, f) => sum + (f.amount || 0), 0);
            
            // Record direct sale
            await docClient.send(new PutCommand({
              TableName: process.env.SALES_TRACKING_TABLE,
              Item: {
                tracking_id: `TRACK_${ro.ro_id}_${declinedJob.id}_${Date.now()}`,
                ro_id: ro.ro_id,
                vehicle_id: vehicleId,
                completed_ro_id: completedRO.id,
                job_id: declinedJob.id,
                job_name: declinedJob.name,
                job_category: declinedJob.category,
                type: 'direct',
                revenue: revenue,
                completed: true,
                completed_date: completedRO.postedDate,
                created_at: new Date().toISOString()
              }
            }));
            
            directSalesCount++;
            totalDirectRevenue += revenue;
            console.log(`💵 Direct sale: ${declinedJob.name} - $${revenue.toFixed(2)}`);
          }
          
          // INDIRECT SALES: Additional authorized jobs not in declined list
          const additionalJobs = completedJobs.filter(j => 
            j.authorized === true &&
            !(ro.declined_jobs || []).some(dj => dj.name === j.name)
          );
          
          for (const additionalJob of additionalJobs) {
            const revenue = (additionalJob.laborHours || 0) * (additionalJob.laborRate || 0) +
                          (additionalJob.parts || []).reduce((sum, p) => sum + (p.retail || 0) * (p.quantity || 1), 0) +
                          (additionalJob.fees || []).reduce((sum, f) => sum + (f.amount || 0), 0);
            
            // Record indirect sale
            await docClient.send(new PutCommand({
              TableName: process.env.SALES_TRACKING_TABLE,
              Item: {
                tracking_id: `TRACK_${ro.ro_id}_INDIRECT_${additionalJob.id}_${Date.now()}`,
                ro_id: ro.ro_id,
                vehicle_id: vehicleId,
                completed_ro_id: completedRO.id,
                job_id: additionalJob.id,
                job_name: additionalJob.name,
                job_category: additionalJob.jobCategory,
                type: 'indirect',
                revenue: revenue,
                completed: true,
                completed_date: completedRO.postedDate,
                created_at: new Date().toISOString()
              }
            }));
            
            indirectSalesCount++;
            totalIndirectRevenue += revenue;
            console.log(`💸 Indirect sale: ${additionalJob.name} - $${revenue.toFixed(2)}`);
          }
        }
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`✅ Sales tracking complete:`);
    console.log(`   Direct: ${directSalesCount} jobs, $${totalDirectRevenue.toFixed(2)}`);
    console.log(`   Indirect: ${indirectSalesCount} jobs, $${totalIndirectRevenue.toFixed(2)}`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        direct_sales: {
          count: directSalesCount,
          revenue: totalDirectRevenue
        },
        indirect_sales: {
          count: indirectSalesCount,
          revenue: totalIndirectRevenue
        }
      })
    };
    
  } catch (error) {
    console.error('❌ Sales tracking failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
