const https = require('https');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION });

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Content-Type': 'application/json'
};

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

async function fetchUsers(accessToken, shopId) {
  const options = {
    hostname: 'shop.tekmetric.com',
    path: `/api/v1/employees?shopId=${shopId}`,
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
  console.log('👥 Fetching users from Tekmetric...');
  
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  try {
    const credentials = await getTekmetricCredentials();
    const accessToken = await getAccessToken(credentials);
    const users = await fetchUsers(accessToken, credentials.shop_id);
    
    // Format for frontend
    const formattedUsers = users.map(user => ({
      id: user.id,
      name: user.name || `${user.firstName} ${user.lastName}`,
      email: user.email,
      role: user.role,
      active: user.active !== false
    })).filter(u => u.active); // Only active users
    
    console.log(`✅ Fetched ${formattedUsers.length} active users`);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        users: formattedUsers
      })
    };
    
  } catch (error) {
    console.error('❌ Error fetching users:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
