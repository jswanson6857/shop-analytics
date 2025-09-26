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
    Handle WebSocket connections and disconnections
    """
    
    try:
        # Get environment variables
        connection_table_name = os.environ.get('CONNECTION_TABLE_NAME')
        
        # Get connection info
        connection_id = event['requestContext']['connectionId']
        route_key = event['requestContext']['routeKey']
        
        logger.info(f"WebSocket event: {route_key} for connection {connection_id}")
        
        # Get connections table
        connections_table = dynamodb.Table(connection_table_name)
        
        if route_key == '$connect':
            # Store new connection
            ttl = int((datetime.utcnow() + timedelta(hours=2)).timestamp())  # 2-hour TTL
            
            connections_table.put_item(
                Item={
                    'connectionId': connection_id,
                    'timestamp': datetime.utcnow().isoformat(),
                    'ttl': ttl
                }
            )
            
            logger.info(f"Stored connection: {connection_id}")
            
            return {
                'statusCode': 200,
                'body': json.dumps({'message': 'Connected successfully'})
            }
            
        elif route_key == '$disconnect':
            # Remove connection
            connections_table.delete_item(
                Key={'connectionId': connection_id}
            )
            
            logger.info(f"Removed connection: {connection_id}")
            
            return {
                'statusCode': 200,
                'body': json.dumps({'message': 'Disconnected successfully'})
            }
        
        else:
            logger.warning(f"Unknown route: {route_key}")
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Unknown route'})
            }
            
    except Exception as e:
        logger.error(f"Error handling WebSocket event: {str(e)}", exc_info=True)
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Internal server error'})
        }