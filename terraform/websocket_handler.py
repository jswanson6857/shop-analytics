# terraform/websocket_handler.py - FIXED VERSION
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
    Handle WebSocket connections and disconnections - FIXED VERSION
    Must return proper API Gateway WebSocket response format
    """
    
    try:
        # Log the full event for debugging
        logger.info(f"WebSocket event received: {json.dumps(event, default=str)}")
        
        # Get environment variables with defaults
        connection_table_name = os.environ.get('CONNECTION_TABLE_NAME', 'webhook-ingestion-websocket-connections')
        
        # Extract route key and connection info
        route_key = event['requestContext'].get('routeKey', '')
        connection_id = event['requestContext'].get('connectionId', '')
        domain_name = event['requestContext'].get('domainName', '')
        stage = event['requestContext'].get('stage', '')
        
        logger.info(f"Processing route: {route_key} for connection: {connection_id}")
        
        # Validate required fields
        if not connection_id:
            logger.error("Missing connectionId in request")
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Missing connectionId'})
            }
        
        # Get connections table
        try:
            connections_table = dynamodb.Table(connection_table_name)
        except Exception as e:
            logger.error(f"Failed to get DynamoDB table {connection_table_name}: {str(e)}")
            return {
                'statusCode': 500,
                'body': json.dumps({'error': 'Database connection failed'})
            }
        
        # Handle different routes
        if route_key == '$connect':
            return handle_connect(connections_table, event, connection_id, domain_name, stage)
        elif route_key == '$disconnect':
            return handle_disconnect(connections_table, connection_id)
        elif route_key == '$default':
            return handle_default_message(event, connection_id)
        else:
            logger.warning(f"Unknown route: {route_key}")
            return {
                'statusCode': 400,
                'body': json.dumps({'error': f'Unknown route: {route_key}'})
            }
            
    except Exception as e:
        logger.error(f"Unexpected error in WebSocket handler: {str(e)}", exc_info=True)
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e),
                'requestId': context.aws_request_id
            })
        }

def handle_connect(connections_table, event, connection_id, domain_name, stage):
    """Handle WebSocket $connect route"""
    try:
        # Extract connection metadata
        source_ip = event['requestContext'].get('identity', {}).get('sourceIp', 'unknown')
        user_agent = event.get('headers', {}).get('User-Agent', 'unknown')
        
        # Create TTL (2 hours from now)
        ttl = int((datetime.utcnow() + timedelta(hours=2)).timestamp())
        
        # Store connection info
        connection_item = {
            'connectionId': connection_id,
            'timestamp': datetime.utcnow().isoformat(),
            'ttl': ttl,
            'sourceIp': source_ip,
            'userAgent': user_agent,
            'domain': domain_name,
            'stage': stage,
            'connected': True
        }
        
        connections_table.put_item(Item=connection_item)
        logger.info(f"✅ Stored connection: {connection_id} from {source_ip}")
        
        # Return success response (CRITICAL: Must return 200 for WebSocket to stay open)
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Connected successfully',
                'connectionId': connection_id,
                'timestamp': datetime.utcnow().isoformat()
            })
        }
        
    except Exception as e:
        logger.error(f"Error in handle_connect: {str(e)}", exc_info=True)
        # Return 200 even on error to keep connection alive, but log the issue
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Connected with warnings',
                'connectionId': connection_id,
                'warning': str(e)
            })
        }

def handle_disconnect(connections_table, connection_id):
    """Handle WebSocket $disconnect route"""
    try:
        # Remove connection from table
        connections_table.delete_item(
            Key={'connectionId': connection_id}
        )
        logger.info(f"✅ Removed connection: {connection_id}")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Disconnected successfully',
                'connectionId': connection_id
            })
        }
        
    except Exception as e:
        logger.warning(f"Error removing connection {connection_id}: {str(e)}")
        # Return 200 anyway since disconnection is happening
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Disconnected with warnings',
                'connectionId': connection_id,
                'warning': str(e)
            })
        }

def handle_default_message(event, connection_id):
    """Handle messages sent from client to WebSocket"""
    try:
        body = event.get('body')
        if body:
            try:
                message = json.loads(body)
                logger.info(f"📨 Message from {connection_id}: {message.get('type', 'unknown')}")
                
                # Handle ping messages
                if message.get('type') == 'ping':
                    logger.info(f"🏓 Ping received from {connection_id}")
                    return {
                        'statusCode': 200,
                        'body': json.dumps({
                            'type': 'pong',
                            'timestamp': datetime.utcnow().isoformat(),
                            'connectionId': connection_id,
                            'message': 'pong'
                        })
                    }
                    
            except json.JSONDecodeError:
                logger.warning(f"Invalid JSON received from {connection_id}: {body}")
        
        # Default response for any message
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Message received',
                'connectionId': connection_id,
                'timestamp': datetime.utcnow().isoformat()
            })
        }
        
    except Exception as e:
        logger.error(f"Error in handle_default_message: {str(e)}", exc_info=True)
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Message processed with warnings',
                'connectionId': connection_id,
                'warning': str(e)
            })
        }