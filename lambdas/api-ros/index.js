const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// CORS headers
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Content-Type': 'application/json'
};

// Get ROs by status
async function getROsByStatus(status) {
  const command = new QueryCommand({
    TableName: process.env.REPAIR_ORDERS_TABLE,
    IndexName: 'StatusIndex',
    KeyConditionExpression: '#status = :status',
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':status': status
    }
  });
  
  const response = await docClient.send(command);
  return response.Items || [];
}

// Get all job categories from current ROs
async function getJobCategories(status = 'FOLLOW_UP_BOARD') {
  const ros = await getROsByStatus(status);
  
  const categoryMap = new Map();
  
  ros.forEach(ro => {
    (ro.declined_jobs || []).forEach(job => {
      const category = job.category || 'Other';
      
      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          name: category,
          declined_count: 0,
          declined_value: 0,
          approved_count: 0,
          approved_value: 0,
          ro_ids: []
        });
      }
      
      const cat = categoryMap.get(category);
      cat.declined_count++;
      cat.declined_value += job.subtotal || 0;
      cat.ro_ids.push(ro.ro_id);
    });
    
    // Add approved jobs for this RO to relevant categories
    (ro.approved_jobs || []).forEach(job => {
      // Try to find matching declined job category
      const matchingDeclined = (ro.declined_jobs || []).find(dj => 
        dj.name === job.name || dj.id === job.id
      );
      
      if (matchingDeclined && categoryMap.has(matchingDeclined.category)) {
        const cat = categoryMap.get(matchingDeclined.category);
        cat.approved_count++;
        cat.approved_value += job.total || 0;
      }
    });
  });
  
  // Convert to array and calculate close ratios
  return Array.from(categoryMap.values()).map(cat => ({
    ...cat,
    close_ratio: cat.approved_count > 0 ?
      ((cat.approved_count / (cat.approved_count + cat.declined_count)) * 100).toFixed(1) :
      '0.0',
    ro_ids: [...new Set(cat.ro_ids)] // Deduplicate
  }));
}

// Main handler
exports.handler = async (event) => {
  console.log('📥 API request:', JSON.stringify(event, null, 2));
  
  // Handle OPTIONS for CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  try {
    const queryParams = event.queryStringParameters || {};
    const { status, view, category, serviceWriter, dateFilter } = queryParams;
    
    // Get job categories view
    if (view === 'categories') {
      const categories = await getJobCategories(status || 'FOLLOW_UP_BOARD');
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          categories
        })
      };
    }
    
    // Get ROs
    let ros = status ? 
      await getROsByStatus(status) : 
      (await docClient.send(new ScanCommand({ TableName: process.env.REPAIR_ORDERS_TABLE }))).Items || [];
    
    // Filter by category
    if (category && category !== 'all') {
      ros = ros.filter(ro => 
        (ro.job_categories || []).includes(category)
      );
    }
    
    // Filter by service writer
    if (serviceWriter && serviceWriter !== 'all') {
      ros = ros.filter(ro => ro.service_writer === serviceWriter);
    }
    
    // Filter by date
    if (dateFilter) {
      const now = new Date();
      const daysAgo = parseInt(dateFilter);
      const cutoffDate = new Date(now.setDate(now.getDate() - daysAgo)).toISOString();
      
      ros = ros.filter(ro => ro.posted_date >= cutoffDate);
    }
    
    // Sort by posted date (newest first)
    ros.sort((a, b) => new Date(b.posted_date) - new Date(a.posted_date));
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        items: ros,
        count: ros.length
      })
    };
    
  } catch (error) {
    console.error('❌ Error:', error);
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
