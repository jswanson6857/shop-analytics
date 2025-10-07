import os
import json
import boto3
from datetime import datetime, timedelta
from decimal import Decimal
from boto3.dynamodb.conditions import Key

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
    try:
        if event.get('httpMethod') == 'OPTIONS':
            return {'statusCode': 200, 'headers': get_cors_headers(), 'body': json.dumps({'message': 'CORS preflight'})}

        # Pagination support
        query_params = event.get('queryStringParameters') or {}
        limit = min(int(query_params.get('limit', 500)), 500)
        last_key = query_params.get('last_key')  # Base64 or JSON encoded

        # Last 30 days
        start_time = (datetime.utcnow() - timedelta(days=30)).isoformat()

        key_condition = Key('pk').eq('all') & Key('timestamp').gte(start_time)
        kwargs = {
            'IndexName': 'all-timestamp-index',
            'KeyConditionExpression': key_condition,
            'Limit': limit
        }

        if last_key:
            import base64
            kwargs['ExclusiveStartKey'] = json.loads(base64.b64decode(last_key).decode('utf-8'))

        response = table.query(**kwargs)
        items = response.get('Items', [])

        # Encode the last evaluated key for pagination
        next_key = response.get('LastEvaluatedKey')
        encoded_next_key = None
        if next_key:
            encoded_next_key = base64.b64encode(json.dumps(next_key).encode('utf-8')).decode('utf-8')

        return {
            'statusCode': 200,
            'headers': get_cors_headers(),
            'body': json.dumps({'items': items, 'next_key': encoded_next_key}, cls=DecimalEncoder)
        }

    except Exception as e:
        return {
            'statusCode': 500,
            'headers': get_cors_headers(),
            'body': json.dumps({'error': str(e)})
        }
