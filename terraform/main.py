# terraform/main.py - Updated to save to DynamoDB
import json
import logging
import os
import boto3
import uuid
from datetime import datetime, timedelta
from decimal import Decimal

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize DynamoDB client
dynamodb = boto3.resource('dynamodb')

def lambda_handler(event, context):
    """
    AWS Lambda function to handle webhook data ingestion
    Now saves data to DynamoDB for real-time processing
    """
    
    try:
        # Environment variables
        project_name = os.environ.get('PROJECT_NAME', 'webhook-ingestion')
        environment = os.environ.get('ENVIRONMENT', 'dev')
        table_name = os.environ.get('DYNAMODB_TABLE_NAME', f'{project_name}-webhook-data')
        
        logger.info(f"Processing webhook for {project_name} in {environment} environment")
        
        # Get DynamoDB table
        table = dynamodb.Table(table_name)
        
        # Extract request information
        http_method = event.get('httpMethod', 'UNKNOWN')
        request_time = datetime.utcnow()
        request_time_str = request_time.isoformat()
        source_ip = event.get('requestContext', {}).get('identity', {}).get('sourceIp', 'unknown')
        user_agent = event.get('headers', {}).get('User-Agent', 'unknown')
        
        # Generate unique ID for this webhook event
        webhook_id = str(uuid.uuid4())
        
        # Log request metadata
        logger.info(f"Request metadata: method={http_method}, time={request_time_str}, ip={source_ip}")
        
        # Extract headers (excluding sensitive ones)
        headers = event.get('headers', {})
        safe_headers = {k: v for k, v in headers.items() if k.lower() not in ['authorization', 'x-api-key']}
        
        # Parse body
        body = event.get('body')
        parsed_body = None
        raw_body = body
        
        if body:
            try:
                # Try to parse as JSON
                if headers.get('Content-Type', '').startswith('application/json'):
                    parsed_body = json.loads(body)
                    logger.info(f"JSON body parsed successfully")
                else:
                    logger.info(f"Raw body received (length: {len(body)})")
            except json.JSONDecodeError:
                logger.info(f"Non-JSON body received (length: {len(body)})")
        
        # Determine webhook source from headers or body
        webhook_source = 'unknown'
        if 'x-github-event' in headers:
            webhook_source = 'github'
        elif 'stripe-signature' in headers:
            webhook_source = 'stripe'
        elif user_agent and 'discord' in user_agent.lower():
            webhook_source = 'discord'
        elif parsed_body and 'object' in parsed_body:
            webhook_source = 'stripe'  # Stripe objects
        elif parsed_body and 'repository' in parsed_body:
            webhook_source = 'github'  # GitHub webhooks
        
        # Prepare DynamoDB item
        webhook_item = {
            'id': webhook_id,
            'timestamp': request_time_str,
            'source': webhook_source,
            'http_method': http_method,
            'source_ip': source_ip,
            'user_agent': user_agent,
            'headers': safe_headers,
            'query_parameters': event.get('queryStringParameters') or {},
            'path_parameters': event.get('pathParameters') or {},
            'raw_body': raw_body,
            'parsed_body': parsed_body,
            'ttl': int((request_time + timedelta(days=30)).timestamp()),  # 30-day TTL
            'created_at': request_time_str,
            'request_id': context.aws_request_id
        }
        
        # Convert any float values to Decimal for DynamoDB
        webhook_item = json.loads(json.dumps(webhook_item), parse_float=Decimal)
        
        # Save to DynamoDB
        logger.info(f"Saving webhook data to DynamoDB table: {table_name}")
        table.put_item(Item=webhook_item)
        logger.info(f"Successfully saved webhook {webhook_id} to DynamoDB")
        
        # Log summary
        logger.info(f"Webhook processed: ID={webhook_id}, Source={webhook_source}, Method={http_method}")
        
        # Create response
        response_body = {
            "message": "Webhook received and stored successfully",
            "webhook_id": webhook_id,
            "timestamp": request_time_str,
            "source": webhook_source,
            "request_id": context.aws_request_id,
            "status": "processed"
        }
        
        # Success response
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
            },
            'body': json.dumps(response_body)
        }
        
    except Exception as e:
        # Log the error
        logger.error(f"Error processing webhook: {str(e)}", exc_info=True)
        
        # Error response
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                "error": "Internal server error",
                "message": "Failed to process webhook",
                "request_id": context.aws_request_id
            })
        }