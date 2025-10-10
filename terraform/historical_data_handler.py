# terraform/historical_data_handler.py - UPDATED: Uses pk field for queries
import os
import json
import boto3
from datetime import datetime, timedelta
from decimal import Decimal
from boto3.dynamodb.conditions import Key
import base64

dynamodb = boto3.resource('dynamodb')
table_name = os.environ.get('DYNAMODB_TABLE_NAME', 'webhook-ingestion-webhook-data')
table = dynamodb.Table(table_name)

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)

def get_cors_headers():
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
    }

def lambda_handler(event, context):
    """
    Fetch historical repair order data with pagination support
    Uses the all-timestamp-index GSI for efficient time-based queries
    """
    try:
        # Handle OPTIONS for CORS
        if event.get('httpMethod') == 'OPTIONS':
            return {
                'statusCode': 200,
                'headers': get_cors_headers(),
                'body': json.dumps({'message': 'CORS preflight'})
            }

        # Parse query parameters
        query_params = event.get('queryStringParameters') or {}
        
        # Pagination support
        limit = min(int(query_params.get('limit', 500)), 500)
        last_key_encoded = query_params.get('lastKey')
        
        # Time range (default: last 30 days)
        hours = int(query_params.get('hours', 720))  # 720 hours = 30 days
        start_time = (datetime.utcnow() - timedelta(hours=hours)).isoformat()

        # Build query
        key_condition = Key('pk').eq('all') & Key('timestamp').gte(start_time)
        
        query_kwargs = {
            'IndexName': 'all-timestamp-index',
            'KeyConditionExpression': key_condition,
            'Limit': limit,
            'ScanIndexForward': False  # Newest first
        }

        # Handle pagination
        if last_key_encoded:
            try:
                last_key = json.loads(base64.b64decode(last_key_encoded).decode('utf-8'))
                query_kwargs['ExclusiveStartKey'] = last_key
            except Exception as e:
                print(f"Error decoding lastKey: {str(e)}")
                # Continue without lastKey if decoding fails

        # Execute query
        response = table.query(**query_kwargs)
        items = response.get('Items', [])

        # Encode next pagination key
        next_key = response.get('LastEvaluatedKey')
        encoded_next_key = None
        if next_key:
            encoded_next_key = base64.b64encode(
                json.dumps(next_key, cls=DecimalEncoder).encode('utf-8')
            ).decode('utf-8')

        # Return results
        return {
            'statusCode': 200,
            'headers': get_cors_headers(),
            'body': json.dumps({
                'events': items,
                'lastKey': encoded_next_key,
                'count': len(items),
                'hasMore': next_key is not None
            }, cls=DecimalEncoder)
        }

    except Exception as e:
        print(f"Error fetching historical data: {str(e)}")
        return {
            'statusCode': 500,
            'headers': get_cors_headers(),
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e)
            })
        }