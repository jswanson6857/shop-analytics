const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Content-Type': 'application/json'
};

// Calculate outbound calls analytics
function calculateOutboundCalls(contactHistory) {
  const analytics = {
    first_reach: 0,
    second_reach: 0,
    third_plus_reach: 0,
    appointment_calls: 0,
    total: 0
  };
  
  contactHistory.forEach(contact => {
    if (contact.reach_count === 1) {
      analytics.first_reach++;
    } else if (contact.reach_count === 2) {
      analytics.second_reach++;
    } else if (contact.reach_count >= 3) {
      analytics.third_plus_reach++;
    }
    
    if (contact.job_interests?.some(j => j.interest_status === 'appointment_made')) {
      analytics.appointment_calls++;
    }
    
    analytics.total++;
  });
  
  return analytics;
}

// Calculate contacted calls (includes voicemail/text)
function calculateContactedCalls(contactHistory) {
  const analytics = {
    first_reach: 0,
    second_reach: 0,
    third_plus_reach: 0,
    appointment_calls: 0,
    total: 0
  };
  
  // Group by RO to get accurate reach counts
  const roContacts = {};
  
  contactHistory.forEach(contact => {
    if (!roContacts[contact.ro_id]) {
      roContacts[contact.ro_id] = [];
    }
    roContacts[contact.ro_id].push(contact);
  });
  
  Object.values(roContacts).forEach(contacts => {
    const sortedContacts = contacts.sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );
    
    sortedContacts.forEach((contact, index) => {
      const reach = index + 1;
      
      if (reach === 1) {
        analytics.first_reach++;
      } else if (reach === 2) {
        analytics.second_reach++;
      } else {
        analytics.third_plus_reach++;
      }
      
      if (contact.job_interests?.some(j => j.interest_status === 'appointment_made')) {
        analytics.appointment_calls++;
      }
      
      analytics.total++;
    });
  });
  
  return analytics;
}

// Calculate summary stats
function calculateSummaryStats(ros, contactHistory) {
  const stats = {
    leads: 0,
    appointments_made: 0,
    not_interested: 0,
    work_completed: 0,
    voicemails: 0,
    texts: 0
  };
  
  const processedROs = new Set();
  
  ros.forEach(ro => {
    // Leads = Interested or Appointment Made (count once per RO)
    const hasInterested = contactHistory
      .filter(c => c.ro_id === ro.ro_id)
      .some(c => c.job_interests?.some(j => 
        j.interest_status === 'interested' || j.interest_status === 'appointment_made'
      ));
    
    if (hasInterested && !processedROs.has(ro.ro_id)) {
      stats.leads++;
      processedROs.add(ro.ro_id);
    }
    
    // Appointments Made
    if (ro.status === 'APPOINTMENT_TRACKER') {
      stats.appointments_made++;
    }
    
    // Not Interested (once per RO even if multiple jobs)
    const hasNotInterested = contactHistory
      .filter(c => c.ro_id === ro.ro_id)
      .some(c => c.job_interests?.some(j => j.interest_status === 'not_interested'));
    
    if (hasNotInterested) {
      stats.not_interested++;
    }
    
    // Work Completed
    const hasWorkCompleted = contactHistory
      .filter(c => c.ro_id === ro.ro_id)
      .some(c => c.job_interests?.some(j => j.interest_status === 'work_completed'));
    
    if (hasWorkCompleted) {
      stats.work_completed++;
    }
  });
  
  // Voicemails and Texts (can duplicate)
  contactHistory.forEach(contact => {
    if (contact.contact_method === 'voicemail') {
      stats.voicemails++;
    } else if (contact.contact_method === 'text') {
      stats.texts++;
    }
  });
  
  return stats;
}

// Calculate sales by job category
function calculateSalesByCategory(ros, contactHistory, salesTracking) {
  const categoryStats = {};
  
  ros.forEach(ro => {
    const roContacts = contactHistory.filter(c => c.ro_id === ro.ro_id);
    
    (ro.declined_jobs || []).forEach(job => {
      const category = job.category || 'Other';
      
      if (!categoryStats[category]) {
        categoryStats[category] = {
          name: category,
          calls: 0,
          completed: 0,
          revenue: 0
        };
      }
      
      // Count calls for this category
      categoryStats[category].calls += roContacts.length;
      
      // Check if completed (from sales tracking)
      const completed = salesTracking.find(s => 
        s.ro_id === ro.ro_id && s.job_id === job.id && s.completed
      );
      
      if (completed) {
        categoryStats[category].completed++;
        categoryStats[category].revenue += completed.revenue || 0;
      }
    });
  });
  
  return Object.values(categoryStats);
}

exports.handler = async (event) => {
  console.log('📊 Calculating analytics...');
  
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  try {
    const queryParams = event.queryStringParameters || {};
    const { user_id, start_date, end_date } = queryParams;
    
    // Fetch all ROs
    let rosResult = await docClient.send(new ScanCommand({
      TableName: process.env.REPAIR_ORDERS_TABLE
    }));
    let ros = rosResult.Items || [];
    
    // Fetch all contact history
    let contactResult = await docClient.send(new ScanCommand({
      TableName: process.env.CONTACT_HISTORY_TABLE
    }));
    let contactHistory = contactResult.Items || [];
    
    // Fetch sales tracking
    let salesResult = await docClient.send(new ScanCommand({
      TableName: process.env.SALES_TRACKING_TABLE
    }));
    let salesTracking = salesResult.Items || [];
    
    // Filter by user if specified
    if (user_id && user_id !== 'all') {
      contactHistory = contactHistory.filter(c => c.user_id === user_id);
    }
    
    // Filter by date range if specified
    if (start_date) {
      contactHistory = contactHistory.filter(c => c.timestamp >= start_date);
    }
    if (end_date) {
      contactHistory = contactHistory.filter(c => c.timestamp <= end_date);
    }
    
    // Calculate all metrics
    const outboundCalls = calculateOutboundCalls(
      contactHistory.filter(c => c.contact_method === 'call')
    );
    
    const contactedCalls = calculateContactedCalls(contactHistory);
    
    const summaryStats = calculateSummaryStats(ros, contactHistory);
    
    // Calculate appointments breakdown
    const appointments = {
      made: ros.filter(ro => ro.status === 'APPOINTMENT_TRACKER').length,
      completed: salesTracking.filter(s => s.type === 'direct' && s.completed).length,
      missed: ros.filter(ro => ro.status === 'APPOINTMENT_TRACKER' && ro.no_show).length,
      upcoming: ros.filter(ro => ro.status === 'APPOINTMENT_TRACKER' && !ro.no_show && 
        new Date(ro.follow_up_date) > new Date()).length
    };
    
    // Calculate sales
    const directSales = salesTracking
      .filter(s => s.type === 'direct' && s.completed)
      .reduce((sum, s) => sum + (s.revenue || 0), 0);
    
    const indirectSales = salesTracking
      .filter(s => s.type === 'indirect' && s.completed)
      .reduce((sum, s) => sum + (s.revenue || 0), 0);
    
    const salesByCategory = calculateSalesByCategory(ros, contactHistory, salesTracking);
    
    console.log('✅ Analytics calculated');
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        analytics: {
          outbound_calls: outboundCalls,
          contacted_calls: contactedCalls,
          summary: summaryStats,
          appointments: appointments,
          sales: {
            direct: directSales,
            indirect: indirectSales
          },
          sales_by_category: salesByCategory
        }
      })
    };
    
  } catch (error) {
    console.error('❌ Error calculating analytics:', error);
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
