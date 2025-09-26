# terraform/websocket_handler.py
import json
import logging
import os
import boto3
from datetime import datetime, timedelta

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize DynamoDB client
dynamodb = boto3.resource('dynamodb')

def lambda_handler(event, context):
    """
    Handle WebSocket connections and disconnections with enhanced error handling
    """
    
    try:
        # Get environment variables
        connection_table_name = os.environ.get('CONNECTION_TABLE_NAME')
        
        # Log the full event for debugging
        logger.info(f"WebSocket event received: {json.dumps(event, default=str)}")
        
        # Get connection info
        connection_id = event['requestContext']['connectionId']
        route_key = event['requestContext']['routeKey']
        domain_name = event['requestContext']['domainName']
        stage = event['requestContext']['stage']
        
        logger.info(f"WebSocket event: {route_key} for connection {connection_id}")
        logger.info(f"Domain: {domain_name}, Stage: {stage}")
        
        # Get connections table
        connections_table = dynamodb.Table(connection_table_name)
        
        if route_key == '$connect':
            # Extract additional connection info
            source_ip = event['requestContext'].get('identity', {}).get('sourceIp', 'unknown')
            user_agent = event.get('headers', {}).get('User-Agent', 'unknown')
            
            # Store new connection with metadata
            ttl = int((datetime.utcnow() + timedelta(hours=2)).timestamp())  # 2-hour TTL
            
            connection_item = {
                'connectionId': connection_id,
                'timestamp': datetime.utcnow().isoformat(),
                'ttl': ttl,
                'sourceIp': source_ip,
                'userAgent': user_agent,
                'domain': domain_name,
                'stage': stage
            }
            
            connections_table.put_item(Item=connection_item)
            
            logger.info(f"Stored connection: {connection_id} from {source_ip}")
            
            return {
                'statusCode': 200,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
                },
                'body': json.dumps({
                    'message': 'Connected successfully',
                    'connectionId': connection_id,
                    'timestamp': datetime.utcnow().isoformat()
                })
            }
            
        elif route_key == '$disconnect':
            # Remove connection
            try:
                connections_table.delete_item(
                    Key={'connectionId': connection_id}
                )
                logger.info(f"Removed connection: {connection_id}")
            except Exception as e:
                logger.warning(f"Failed to remove connection {connection_id}: {str(e)}")
            
            return {
                'statusCode': 200,
                'headers': {
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'message': 'Disconnected successfully',
                    'connectionId': connection_id
                })
            }
        
        elif route_key == '$default':
            # Handle default route (messages sent from client)
            body = event.get('body')
            if body:
                try:
                    message = json.loads(body)
                    logger.info(f"Received message from {connection_id}: {message}")
                    
                    # Echo back a pong for ping messages
                    if message.get('type') == 'ping':
                        return {
                            'statusCode': 200,
                            'body': json.dumps({
                                'type': 'pong',
                                'timestamp': datetime.utcnow().isoformat(),
                                'connectionId': connection_id
                            })
                        }
                except json.JSONDecodeError:
                    logger.warning(f"Invalid JSON received from {connection_id}")
            
            return {
                'statusCode': 200,
                'body': json.dumps({'message': 'Message received'})
            }
        
        else:
            logger.warning(f"Unknown route: {route_key}")
            return {
                'statusCode': 400,
                'headers': {
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': f'Unknown route: {route_key}'})
            }
            
    except Exception as e:
        logger.error(f"Error handling WebSocket event: {str(e)}", exc_info=True)
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e)
            })
        }