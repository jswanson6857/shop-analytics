# terraform/historical_data_handler.py
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

def lambda_handler(event, context):
    """
    AWS Lambda function to serve historical webhook data for initial page load
    """
    
    try:
        # Environment variables
        table_name = os.environ.get('DYNAMODB_TABLE_NAME', 'webhook-ingestion-webhook-data')
        
        logger.info(f"Fetching historical data from table: {table_name}")
        
        # Get DynamoDB table
        table = dynamodb.Table(table_name)
        
        # Parse query parameters
        query_params = event.get('queryStringParameters') or {}
        limit = min(int(query_params.get('limit', 50)), 100)  # Max 100 items, default 50
        hours_back = min(int(query_params.get('hours', 24)), 168)  # Max 7 days, default 24 hours
        
        # Calculate time range
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=hours_back)
        
        logger.info(f"Fetching last {hours_back} hours of data, limit {limit} items")
        
        # Query DynamoDB for recent data
        try:
            # Scan with filter for recent data (you might want to use GSI for better performance)
            response = table.scan(
                FilterExpression='created_at >= :start_time',
                ExpressionAttributeValues={
                    ':start_time': start_time.isoformat()
                },
                Limit=limit
            )
            
            items = response.get('Items', [])
            
            # Sort by timestamp descending (newest first)
            items.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
            
            logger.info(f"Found {len(items)} historical items")
            
            # Transform DynamoDB items to webhook format expected by frontend
            historical_events = []
            for item in items:
                try:
                    # Convert DynamoDB item to webhook format
                    webhook_event = {
                        'id': item.get('id'),
                        'timestamp': item.get('timestamp'),
                        'body': {
                            'data': item.get('parsed_body'),
                            'event': f"Historical: {item.get('source', 'unknown')} event"
                        }
                    }
                    
                    # Only include items that have valid parsed_body
                    if webhook_event['body']['data']:
                        historical_events.append(webhook_event)
                        
                except Exception as e:
                    logger.warning(f"Error transforming item {item.get('id', 'unknown')}: {str(e)}")
                    continue
            
            logger.info(f"Successfully transformed {len(historical_events)} events")
            
            # Return response
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                    'Access-Control-Allow-Methods': 'GET,OPTIONS',
                    'Cache-Control': 'no-cache, no-store, must-revalidate'
                },
                'body': json.dumps(historical_events, cls=DecimalEncoder)
            }
            
        except Exception as e:
            logger.error(f"Database query failed: {str(e)}", exc_info=True)
            return {
                'statusCode': 500,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'error': 'Database query failed',
                    'message': str(e)
                })
            }
        
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e),
                'requestId': context.aws_request_id
            })
        }