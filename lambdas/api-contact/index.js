const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Content-Type': 'application/json'
};

// Determine new status based on job interests
function determineNewStatus(jobInterests) {
  const hasAppointment = jobInterests.some(j => j.interest_status === 'appointment_made');
  const hasInterested = jobInterests.some(j => j.interest_status === 'interested');
  const allNotInterestedOrCompleted = jobInterests.every(j => 
    j.interest_status === 'not_interested' || j.interest_status === 'work_completed'
  );
  
  // Hierarchy: Appointment Made > Interested > Not Interested/Work Completed
  if (hasAppointment) {
    return 'APPOINTMENT_TRACKER';
  } else if (hasInterested) {
    return 'FOLLOW_UP_TRACKER';
  } else if (allNotInterestedOrCompleted) {
    return 'DELETED';
  } else {
    return 'FOLLOW_UP_TRACKER'; // Default to tracker if mixed
  }
}

// Calculate reach count
function calculateReachCount(contactHistory, newMethod) {
  // Only count actual calls (not voicemail/text)
  const callCount = contactHistory.filter(c => c.contact_method === 'call').length;
  
  if (newMethod === 'call') {
    return callCount + 1;
  } else {
    return callCount; // Voicemail/text don't increment reach count
  }
}

exports.handler = async (event) => {
  console.log('📞 Contact save request:', JSON.stringify(event, null, 2));
  
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  try {
    const { ro_id, contact_data } = JSON.parse(event.body);
    
    // Validation
    if (!ro_id || !contact_data) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Missing ro_id or contact_data'
        })
      };
    }
    
    const { 
      contact_method, 
      job_interests, 
      notes, 
      follow_up_date, 
      assigned_user_id,
      assigned_user_name,
      user_id, 
      user_name,
      is_edit_mode 
    } = contact_data;
    
    // Validation: Must have contact method
    if (!contact_method) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Contact method is required'
        })
      };
    }
    
    // Validation: If call, must have job interests
    if (contact_method === 'call' && (!job_interests || job_interests.length === 0)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Interest status is required for phone calls'
        })
      };
    }
    
    // Get existing RO
    const getResult = await docClient.send(new GetCommand({
      TableName: process.env.REPAIR_ORDERS_TABLE,
      Key: { ro_id }
    }));
    
    if (!getResult.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'RO not found'
        })
      };
    }
    
    const ro = getResult.Item;
    const now = new Date().toISOString();
    
    // Calculate reach count (only for actual calls, not edit mode)
    const reachCount = is_edit_mode ? 
      ro.reach_count : 
      calculateReachCount(ro.contact_history || [], contact_method);
    
    // Create contact history entry (only if not edit mode)
    const contactEntry = is_edit_mode ? null : {
      timestamp: now,
      user_id: user_id || 'unknown',
      user_name: user_name || 'Unknown User',
      contact_method,
      reach_count: reachCount,
      job_interests: job_interests || [],
      notes: notes || '',
      follow_up_date: follow_up_date || null,
      assigned_user_id: assigned_user_id || null,
      assigned_user_name: assigned_user_name || null
    };
    
    // Determine new status
    const newStatus = job_interests && job_interests.length > 0 ?
      determineNewStatus(job_interests) :
      ro.status; // Keep current status if voicemail/text
    
    // Update RO
    const updateExpression = is_edit_mode ?
      'SET updated_at = :now, notes = :notes, follow_up_date = :follow_up_date, assigned_user_id = :assigned_user_id, assigned_user_name = :assigned_user_name' :
      'SET #status = :status, reach_count = :reach_count, contact_history = list_append(if_not_exists(contact_history, :empty_list), :contact_entry), updated_at = :now, follow_up_date = :follow_up_date, assigned_user_id = :assigned_user_id, assigned_user_name = :assigned_user_name, last_contact_date = :now, last_contact_method = :contact_method, last_contact_user = :user_name';
    
    const expressionAttributeNames = is_edit_mode ? {} : { '#status': 'status' };
    
    const expressionAttributeValues = is_edit_mode ? {
      ':now': now,
      ':notes': notes || '',
      ':follow_up_date': follow_up_date || null,
      ':assigned_user_id': assigned_user_id || null,
      ':assigned_user_name': assigned_user_name || null
    } : {
      ':status': newStatus,
      ':reach_count': reachCount,
      ':contact_entry': [contactEntry],
      ':empty_list': [],
      ':now': now,
      ':follow_up_date': follow_up_date || null,
      ':assigned_user_id': assigned_user_id || null,
      ':assigned_user_name': assigned_user_name || null,
      ':contact_method': contact_method,
      ':user_name': user_name || 'Unknown User'
    };
    
    await docClient.send(new UpdateCommand({
      TableName: process.env.REPAIR_ORDERS_TABLE,
      Key: { ro_id },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
      ExpressionAttributeValues: expressionAttributeValues
    }));
    
    // If status changed to APPOINTMENT_TRACKER, create appointment entry
    if (newStatus === 'APPOINTMENT_TRACKER' && !is_edit_mode) {
      const appointmentId = `APPT_${ro_id}_${Date.now()}`;
      await docClient.send(new PutCommand({
        TableName: process.env.APPOINTMENTS_TABLE,
        Item: {
          appointment_id: appointmentId,
          ro_id: ro_id,
          vehicle_id: ro.vehicle?.id,
          appointment_date: follow_up_date || now,
          status: 'pending',
          interested_jobs: job_interests.filter(j => j.interest_status === 'appointment_made'),
          created_at: now,
          updated_at: now
        }
      }));
    }
    
    // Save to contact history table for analytics
    if (!is_edit_mode) {
      await docClient.send(new PutCommand({
        TableName: process.env.CONTACT_HISTORY_TABLE,
        Item: {
          ro_id,
          timestamp: now,
          ...contactEntry
        }
      }));
    }
    
    console.log(`✅ Contact saved for ${ro_id}, new status: ${newStatus}, reach: ${reachCount}`);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        ro_id,
        new_status: newStatus,
        reach_count: reachCount,
        edit_mode: is_edit_mode || false
      })
    };
    
  } catch (error) {
    console.error('❌ Error saving contact:', error);
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
