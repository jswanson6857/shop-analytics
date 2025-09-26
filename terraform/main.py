import json
import logging
import os
from datetime import datetime

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    """
    AWS Lambda function to handle webhook data ingestion
    Logs all incoming webhook data for analysis
    """
    
    try:
        # Log environment info
        project_name = os.environ.get('PROJECT_NAME', 'webhook-ingestion')
        environment = os.environ.get('ENVIRONMENT', 'dev')
        
        logger.info(f"Processing webhook for {project_name} in {environment} environment")
        
        # Extract request information
        http_method = event.get('httpMethod', 'UNKNOWN')
        request_time = datetime.utcnow().isoformat()
        source_ip = event.get('requestContext', {}).get('identity', {}).get('sourceIp', 'unknown')
        user_agent = event.get('headers', {}).get('User-Agent', 'unknown')
        
        # Log request metadata
        logger.info(f"Request metadata: method={http_method}, time={request_time}, ip={source_ip}")
        logger.info(f"User-Agent: {user_agent}")
        
        # Log headers (excluding sensitive ones)
        headers = event.get('headers', {})
        safe_headers = {k: v for k, v in headers.items() if k.lower() not in ['authorization', 'x-api-key']}
        logger.info(f"Request headers: {json.dumps(safe_headers, indent=2)}")
        
        # Log query parameters
        query_params = event.get('queryStringParameters') or {}
        if query_params:
            logger.info(f"Query parameters: {json.dumps(query_params, indent=2)}")
        
        # Parse and log body
        body = event.get('body')
        if body:
            try:
                # Try to parse as JSON
                if event.get('headers', {}).get('Content-Type', '').startswith('application/json'):
                    parsed_body = json.loads(body)
                    logger.info(f"JSON body received: {json.dumps(parsed_body, indent=2)}")
                else:
                    logger.info(f"Raw body received (first 1000 chars): {body[:1000]}")
            except json.JSONDecodeError:
                logger.info(f"Non-JSON body received (first 1000 chars): {body[:1000]}")
        else:
            logger.info("No body received in request")
        
        # Log path parameters if present
        path_params = event.get('pathParameters')
        if path_params:
            logger.info(f"Path parameters: {json.dumps(path_params, indent=2)}")
        
        # Create response
        response_body = {
            "message": "Webhook received successfully",
            "timestamp": request_time,
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
