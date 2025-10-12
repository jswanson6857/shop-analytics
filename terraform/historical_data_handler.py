import os
import json
import boto3
import base64
from datetime import datetime, timedelta
from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor, as_completed

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ.get('DYNAMODB_TABLE_NAME', 'webhook-ingestion-webhook-data'))

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

def parallel_scan(segment, total_segments, filter_expr=None, projection=None):
    kwargs = {'Segment': segment, 'TotalSegments': total_segments}
    if filter_expr:
        kwargs['FilterExpression'] = filter_expr
    if projection:
        kwargs['ProjectionExpression'] = projection

    items = []
    response = table.scan(**kwargs)
    items.extend(response.get('Items', []))

    while 'LastEvaluatedKey' in response:
        response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'], **kwargs)
        items.extend(response.get('Items', []))
    return items

def lambda_handler(event, context):
    try:
        if event.get('httpMethod') == 'OPTIONS':
            return {'statusCode': 200, 'headers': get_cors_headers(), 'body': json.dumps({'message': 'CORS preflight'})}

        params = event.get('queryStringParameters') or {}
        hours = params.get('hours')
        total_segments = int(params.get('segments', 8))  # number of parallel scans (default: 8)
        projection = params.get('fields')  # e.g., "id,timestamp,status"

        # Optional time filter
        filter_expr = None
        if hours:
            start_time = (datetime.utcnow() - timedelta(hours=int(hours))).isoformat()
            from boto3.dynamodb.conditions import Attr
            filter_expr = Attr('timestamp').gte(start_time)

        # Run parallel scans
        all_items = []
        with ThreadPoolExecutor(max_workers=total_segments) as executor:
            futures = [executor.submit(parallel_scan, seg, total_segments, filter_expr, projection) for seg in range(total_segments)]
            for f in as_completed(futures):
                all_items.extend(f.result())

        print(f"✅ Retrieved {len(all_items)} total items across {total_segments} segments")

        return {
            'statusCode': 200,
            'headers': get_cors_headers(),
            'body': json.dumps({
                'events': all_items,
                'count': len(all_items),
                'hasMore': False
            }, cls=DecimalEncoder)
        }

    except Exception as e:
        print(f"Error fetching all data: {e}")
        return {
            'statusCode': 500,
            'headers': get_cors_headers(),
            'body': json.dumps({'error': 'Internal server error', 'message': str(e)})
        }
