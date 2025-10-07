# terraform/historical_data_handler.py - FIXED to load ALL data with pagination
import json
import logging
import os
import boto3
from datetime import datetime, timedelta
from decimal import Decimal

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize DynamoDB client
dynamodb = boto3.resource('dynamodb')

class DecimalEncoder(json.JSONEncoder):
    """Helper class to serialize Decimal objects"""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)

def get_cors_headers():
    """Return consistent CORS headers for all responses"""
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY'
    }

def lambda_handler(event, context):
    """
    AWS Lambda function to serve historical webhook data for initial page load
    FIXED to handle your actual DynamoDB structure and load ALL data
    """
    
    try:
        logger.info(f"Historical data request: {json.dumps(event, default=str)}")
        
        # Handle preflight OPTIONS requests
        if event.get('httpMethod') == 'OPTIONS':
            logger.info("Handling CORS preflight request")
            return {
                'statusCode': 200,
                'headers': get_cors_headers(),
                'body': json.dumps({'message': 'CORS preflight response'})
            }
        
        # Environment variables
        table_name = os.environ.get('DYNAMODB_TABLE_NAME', 'webhook-ingestion-webhook-data')
        
        logger.info(f"Fetching historical data from table: {table_name}")
        
        # Get DynamoDB table
        table = dynamodb.Table(table_name)
        
        # Parse query parameters - FIXED to load ALL data
        query_params = event.get('queryStringParameters') or {}
        limit = min(int(query_params.get('limit', 10000)), 10000)  # Max 10k items, default 10k
        hours_back = min(int(query_params.get('hours', 168)), 8760)  # Max 365 days, default 7 days
        
        # Calculate time range
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=hours_back)
        
        logger.info(f"Fetching ALL data from last {hours_back} hours, limit {limit} items")
        
        # Query DynamoDB for recent data - FIXED: Paginate through ALL results
        try:
            items = []
            last_evaluated_key = None
            
            # Paginate through ALL results
            while True:
                scan_kwargs = {
                    'FilterExpression': '#ts >= :start_time',
                    'ExpressionAttributeNames': {
                        '#ts': 'timestamp'
                    },
                    'ExpressionAttributeValues': {
                        ':start_time': start_time.isoformat()
                    }
                }
                
                if last_evaluated_key:
                    scan_kwargs['ExclusiveStartKey'] = last_evaluated_key
                
                response = table.scan(**scan_kwargs)
                items.extend(response.get('Items', []))
                
                last_evaluated_key = response.get('LastEvaluatedKey')
                
                # Break if no more pages or hit limit
                if not last_evaluated_key or len(items) >= limit:
                    break
            
            # Trim to limit if needed
            items = items[:limit]
            
            # Sort by timestamp descending (newest first)
            items.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
            
            logger.info(f"Found {len(items)} historical items (paginated through all results)")
            
            # Transform DynamoDB items to the format your frontend expects
            historical_events = []
            for item in items:
                try:
                    # Check if this item has parsed_body with actual repair order data
                    parsed_body = item.get('parsed_body')
                    
                    if not parsed_body:
                        logger.debug(f"Skipping item {item.get('id')} - no parsed_body")
                        continue
                    
                    # Your data structure: parsed_body contains {"data": {...}, "event": "..."}
                    # We need to send this in the format your frontend parser expects
                    webhook_event = {
                        'id': item.get('id'),
                        'timestamp': item.get('timestamp'),
                        'parsed_body': parsed_body  # Keep the original structure
                    }
                    
                    historical_events.append(webhook_event)
                    logger.debug(f"Added webhook event for repair order: {parsed_body.get('data', {}).get('repairOrderNumber')}")
                        
                except Exception as e:
                    logger.warning(f"Error transforming item {item.get('id', 'unknown')}: {str(e)}")
                    continue
            
            logger.info(f"Successfully transformed {len(historical_events)} events")
            
            # Return successful response with CORS headers
            return {
                'statusCode': 200,
                'headers': get_cors_headers(),
                'body': json.dumps(historical_events, cls=DecimalEncoder)
            }
            
        except Exception as e:
            logger.error(f"Database query failed: {str(e)}", exc_info=True)
            return {
                'statusCode': 500,
                'headers': get_cors_headers(),
                'body': json.dumps({
                    'error': 'Database query failed',
                    'message': str(e),
                    'requestId': context.aws_request_id,
                    'timestamp': datetime.utcnow().isoformat()
                })
            }
        
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return {
            'statusCode': 500,
            'headers': get_cors_headers(),
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e),
                'requestId': context.aws_request_id,
                'timestamp': datetime.utcnow().isoformat()
            })
        }