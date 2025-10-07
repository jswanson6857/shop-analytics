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

# Initialize DynamoDB resource
dynamodb = boto3.resource('dynamodb')


class DecimalEncoder(json.JSONEncoder):
    """Helper class to serialize Decimal objects"""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)


def get_cors_headers():
    """Consistent CORS headers for all responses"""
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY'
    }


def query_all_recent_data(table, hours_back, limit):
    """
    Query DynamoDB using the all-timestamp-index GSI for maximum efficiency.
    Automatically paginates until limit or all data fetched.
    """
    end_time = datetime.utcnow()
    start_time = end_time - timedelta(hours=hours_back)

    logger.info(f"Querying data between {start_time.isoformat()} and {end_time.isoformat()} (limit={limit})")

    items = []
    last_evaluated_key = None

    while True:
        query_kwargs = {
            'IndexName': 'all-timestamp-index',
            'KeyConditionExpression': Key('pk').eq('ALL') & Key('timestamp').between(start_time.isoformat(), end_time.isoformat()),
            'ScanIndexForward': False,  # newest first
            'Limit': min(limit - len(items), 1000)  # batch size (DynamoDB max 1MB per page)
        }

        if last_evaluated_key:
            query_kwargs['ExclusiveStartKey'] = last_evaluated_key

        response = table.query(**query_kwargs)
        batch = response.get('Items', [])
        items.extend(batch)

        logger.info(f"Fetched {len(batch)} items this page (total={len(items)})")

        last_evaluated_key = response.get('LastEvaluatedKey')
        if not last_evaluated_key or len(items) >= limit:
            break

    return items[:limit]


def lambda_handler(event, context):
    """
    Lambda handler for serving historical webhook data efficiently via GSI.
    Supports pagination and always returns CORS headers.
    """
    try:
        logger.info(f"Received event: {json.dumps(event, default=str)}")

        # Handle CORS preflight
        if event.get('httpMethod') == 'OPTIONS':
            return {
                'statusCode': 200,
                'headers': get_cors_headers(),
                'body': json.dumps({'message': 'CORS preflight OK'})
            }

        # Environment variable for table name
        table_name = os.environ.get('DYNAMODB_TABLE_NAME', 'webhook-ingestion-webhook-data')
        table = dynamodb.Table(table_name)

        # Parse query parameters
        query_params = event.get('queryStringParameters') or {}
        limit = min(int(query_params.get('limit', 10000)), 20000)  # Cap 20k items
        hours_back = min(int(query_params.get('hours', 168)), 8760)  # Cap 1 year

        # Query via GSI
        items = query_all_recent_data(table, hours_back, limit)
        logger.info(f"Total fetched items: {len(items)}")

        # Transform for frontend
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

        logger.info(f"Transformed {len(historical_events)} valid events")

        return {
            'statusCode': 200,
            'headers': get_cors_headers(),
            'body': json.dumps(historical_events, cls=DecimalEncoder)
        }

    except Exception as e:
        logger.error(f"Lambda error: {str(e)}", exc_info=True)
        return {
            'statusCode': 500,
            'headers': get_cors_headers(),
            'body': json.dumps({
                'error': 'Internal Server Error',
                'message': str(e),
                'timestamp': datetime.utcnow().isoformat()
            })
        }
