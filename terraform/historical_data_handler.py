# terraform/historical_data_handler.py - Efficient paginated DynamoDB query using all-timestamp-index
import json
import logging
import os
import boto3
from datetime import datetime, timedelta
from decimal import Decimal
from boto3.dynamodb.conditions import Key

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
    Lambda function to serve historical webhook data efficiently
    using GSI 'all-timestamp-index' and pagination.
    """
    try:
        logger.info(f"Historical data request: {json.dumps(event, default=str)}")

        # Handle preflight OPTIONS requests
        if event.get('httpMethod') == 'OPTIONS':
            return {
                'statusCode': 200,
                'headers': get_cors_headers(),
                'body': json.dumps({'message': 'CORS preflight response'})
            }

        # Environment variables
        table_name = os.environ.get('DYNAMODB_TABLE_NAME', 'webhook-ingestion-webhook-data')
        table = dynamodb.Table(table_name)

        # Query parameters
        query_params = event.get('queryStringParameters') or {}
        limit = min(int(query_params.get('limit', 100)), 500)  # Max 500 per page
        hours_back = min(int(query_params.get('hours', 168)), 8760)  # Default 7 days
        last_key = query_params.get('lastKey')  # Optional pagination token

        # Calculate time range
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=hours_back)

        logger.info(f"Querying all items from last {hours_back} hours, limit {limit}")

        # Build KeyCondition for GSI: pk='ALL' and timestamp >= start_time
        key_condition = Key('pk').eq('ALL') & Key('timestamp').gte(start_time.isoformat())

        scan_kwargs = {
            'IndexName': 'all-timestamp-index',
            'KeyConditionExpression': key_condition,
            'Limit': limit,
            'ScanIndexForward': False  # newest first
        }

        if last_key:
            # Continue from last page
            scan_kwargs['ExclusiveStartKey'] = json.loads(last_key)

        # Query DynamoDB
        response = table.query(**scan_kwargs)
        items = response.get('Items', [])
        last_evaluated_key = response.get('LastEvaluatedKey')

        # Transform items to frontend format
        historical_events = []
        for item in items:
            parsed_body = item.get('parsed_body')
            if not parsed_body:
                continue
            historical_events.append({
                'id': item.get('id'),
                'timestamp': item.get('timestamp'),
                'parsed_body': parsed_body
            })

        logger.info(f"Returning {len(historical_events)} events")

        # Return response with pagination token if more items exist
        return {
            'statusCode': 200,
            'headers': get_cors_headers(),
            'body': json.dumps({
                'events': historical_events,
                'lastKey': json.dumps(last_evaluated_key) if last_evaluated_key else None
            }, cls=DecimalEncoder)
        }

    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return {
            'statusCode': 500,
            'headers': get_cors_headers(),
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e),
                'requestId': getattr(context, 'aws_request_id', None),
                'timestamp': datetime.utcnow().isoformat()
            })
        }
