const https = require('https');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const secretsClient = new SecretsManagerClient({});

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

// Fetch appointments from Tekmetric
async function fetchAppointments(accessToken, shopId) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7); // Last 7 days
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 30); // Next 30 days
  
  const options = {
    hostname: 'shop.tekmetric.com',
    path: `/api/v1/appointments?shopId=${shopId}&startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  };
  
  const response = await makeRequest(options);
  return response.content || [];
}

// Check if new RO was created for vehicle within 24 hours of appointment
async function checkForNewRO(accessToken, shopId, vehicleId, appointmentEndDate) {
  const checkUntil = new Date(appointmentEndDate);
  checkUntil.setHours(checkUntil.getHours() + 24);
  
  const options = {
    hostname: 'shop.tekmetric.com',
    path: `/api/v1/repair-orders?shopId=${shopId}&vehicleId=${vehicleId}&postedStartDate=${new Date(appointmentEndDate).toISOString().split('T')[0]}&postedEndDate=${checkUntil.toISOString().split('T')[0]}`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  };
  
  const response = await makeRequest(options);
  return (response.content || []).length > 0;
}

exports.handler = async (event) => {
  console.log('📅 Starting appointment verification batch job...');
  
  try {
    const credentials = await getTekmetricCredentials();
    const accessToken = await getAccessToken(credentials);
    
    // Fetch Tekmetric appointments
    const tekmetricAppointments = await fetchAppointments(accessToken, credentials.shop_id);
    console.log(`Found ${tekmetricAppointments.length} Tekmetric appointments`);
    
    // Fetch our tracked appointments
    const ourAppointmentsResult = await docClient.send(new ScanCommand({
      TableName: process.env.APPOINTMENTS_TABLE
    }));
    const ourAppointments = ourAppointmentsResult.Items || [];
    
    // Fetch ROs in APPOINTMENT_TRACKER status
    const rosResult = await docClient.send(new QueryCommand({
      TableName: process.env.REPAIR_ORDERS_TABLE,
      IndexName: 'StatusIndex',
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':status': 'APPOINTMENT_TRACKER' }
    }));
    const ros = rosResult.Items || [];
    
    let completedCount = 0;
    let noShowCount = 0;
    let pendingCount = 0;
    
    for (const ro of ros) {
      const vehicleId = ro.vehicle?.id;
      if (!vehicleId) continue;
      
      // Find matching Tekmetric appointment
      const tekmetricAppt = tekmetricAppointments.find(a => 
        a.vehicle?.id === vehicleId
      );
      
      if (!tekmetricAppt) continue;
      
      const appointmentEnd = new Date(tekmetricAppt.endDate);
      const now = new Date();
      
      // Only check if appointment has passed
      if (appointmentEnd > now) {
        pendingCount++;
        continue;
      }
      
      // Check if customer showed up (new RO created within 24 hours)
      const customerShowedUp = await checkForNewRO(
        accessToken,
        credentials.shop_id,
        vehicleId,
        tekmetricAppt.endDate
      );
      
      if (customerShowedUp) {
        // COMPLETED - Move to DELETED, mark as completed
        await docClient.send(new UpdateCommand({
          TableName: process.env.REPAIR_ORDERS_TABLE,
          Key: { ro_id: ro.ro_id },
          UpdateExpression: 'SET #status = :status, completed = :completed, completed_date = :now',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':status': 'DELETED',
            ':completed': true,
            ':now': now.toISOString()
          }
        }));
        
        // Update appointment record
        const ourAppt = ourAppointments.find(a => a.ro_id === ro.ro_id);
        if (ourAppt) {
          await docClient.send(new UpdateCommand({
            TableName: process.env.APPOINTMENTS_TABLE,
            Key: { appointment_id: ourAppt.appointment_id },
            UpdateExpression: 'SET #status = :status, updated_at = :now',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
              ':status': 'completed',
              ':now': now.toISOString()
            }
          }));
        }
        
        completedCount++;
        console.log(`✅ ${ro.ro_id} - Customer showed up`);
        
      } else {
        // NO SHOW - Keep in APPOINTMENT_TRACKER for another callback
        await docClient.send(new UpdateCommand({
          TableName: process.env.REPAIR_ORDERS_TABLE,
          Key: { ro_id: ro.ro_id },
          UpdateExpression: 'SET no_show = :no_show, last_check_date = :now',
          ExpressionAttributeValues: {
            ':no_show': true,
            ':now': now.toISOString()
          }
        }));
        
        // Update appointment record
        const ourAppt = ourAppointments.find(a => a.ro_id === ro.ro_id);
        if (ourAppt) {
          await docClient.send(new UpdateCommand({
            TableName: process.env.APPOINTMENTS_TABLE,
            Key: { appointment_id: ourAppt.appointment_id },
            UpdateExpression: 'SET #status = :status, updated_at = :now',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
              ':status': 'no_show',
              ':now': now.toISOString()
            }
          }));
        }
        
        noShowCount++;
        console.log(`❌ ${ro.ro_id} - No show`);
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`✅ Batch complete: ${completedCount} completed, ${noShowCount} no-shows, ${pendingCount} pending`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        completed: completedCount,
        no_shows: noShowCount,
        pending: pendingCount
      })
    };
    
  } catch (error) {
    console.error('❌ Batch job failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
