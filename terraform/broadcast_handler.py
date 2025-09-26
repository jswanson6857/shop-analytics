# terraform/broadcast_handler.py
import json
import logging
import os
import boto3
from datetime import datetime

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')

def lambda_handler(event, context):
    """
    Handle DynamoDB stream events and broadcast to WebSocket connections
    """
    
    try:
        connection_table_name = os.environ.get('CONNECTION_TABLE_NAME')
        websocket_endpoint = os.environ.get('WEBSOCKET_API_ENDPOINT')
        
        logger.info(f"Processing {len(event.get('Records', []))} DynamoDB stream records")
        
        # Get connections table
        connections_table = dynamodb.Table(connection_table_name)
        
        # Get all active connections
        response = connections_table.scan()
        connections = response.get('Items', [])
        
        logger.info(f"Found {len(connections)} active WebSocket connections")
        
        if not connections:
            logger.info("No active connections to broadcast to")
            return {'statusCode': 200}
        
        # Initialize API Gateway Management API client with the correct endpoint
        if websocket_endpoint:
            apigateway_client = boto3.client('apigatewaymanagementapi', 
                                           endpoint_url=websocket_endpoint)
        else:
            logger.error("WEBSOCKET_API_ENDPOINT not set")
            return {'statusCode': 500}
        
        # Process each DynamoDB stream record
        for record in event.get('Records', []):
            event_name = record['eventName']
            
            if event_name in ['INSERT', 'MODIFY']:
                # Extract webhook data from DynamoDB record
                if 'dynamodb' in record and 'NewImage' in record['dynamodb']:
                    webhook_data = deserialize_dynamodb_item(record['dynamodb']['NewImage'])
                    
                    # Create message for WebSocket clients
                    message = {
                        'type': 'webhook_data',
                        'event': event_name.lower(),
                        'timestamp': datetime.utcnow().isoformat(),
                        'data': {
                            'id': webhook_data.get('id'),
                            'timestamp': webhook_data.get('timestamp'),
                            'source': webhook_data.get('source', 'unknown'),
                            'http_method': webhook_data.get('http_method'),
                            'source_ip': webhook_data.get('source_ip'),
                            'user_agent': webhook_data.get('user_agent'),
                            'headers': webhook_data.get('headers', {}),
                            'parsed_body': webhook_data.get('parsed_body'),
                            'request_id': webhook_data.get('request_id')
                        }
                    }
                    
                    message_json = json.dumps(message)
                    
                    # Send to all connected clients
                    stale_connections = []
                    successful_broadcasts = 0
                    
                    for connection in connections:
                        connection_id = connection['connectionId']
                        
                        try:
                            apigateway_client.post_to_connection(
                                ConnectionId=connection_id,
                                Data=message_json
                            )
                            successful_broadcasts += 1
                            logger.debug(f"Sent message to connection: {connection_id}")
                            
                        except apigateway_client.exceptions.GoneException:
                            # Connection is stale, mark for removal
                            stale_connections.append(connection_id)
                            logger.info(f"Stale connection detected: {connection_id}")
                            
                        except Exception as e:
                            logger.error(f"Error sending to connection {connection_id}: {str(e)}")
                    
                    # Remove stale connections
                    for stale_connection_id in stale_connections:
                        try:
                            connections_table.delete_item(
                                Key={'connectionId': stale_connection_id}
                            )
                            logger.info(f"Removed stale connection: {stale_connection_id}")
                        except Exception as e:
                            logger.error(f"Error removing stale connection {stale_connection_id}: {str(e)}")
                    
                    logger.info(f"Successfully broadcast to {successful_broadcasts} connections, "
                              f"removed {len(stale_connections)} stale connections")
        
        return {'statusCode': 200}
        
    except Exception as e:
        logger.error(f"Error broadcasting to WebSocket connections: {str(e)}", exc_info=True)
        return {'statusCode': 500}

def deserialize_dynamodb_item(dynamodb_item):
    """
    Convert DynamoDB item format to regular Python dict
    """
    def deserialize_value(value):
        if 'S' in value:
            return value['S']
        elif 'N' in value:
            return float(value['N'])
        elif 'B' in value:
            return value['B']
        elif 'SS' in value:
            return value['SS']
        elif 'NS' in value:
            return [float(n) for n in value['NS']]
        elif 'BS' in value:
            return value['BS']
        elif 'M' in value:
            return {k: deserialize_value(v) for k, v in value['M'].items()}
        elif 'L' in value:
            return [deserialize_value(item) for item in value['L']]
        elif 'NULL' in value:
            return None
        elif 'BOOL' in value:
            return value['BOOL']
        else:
            return value
    
    return {key: deserialize_value(value) for key, value in dynamodb_item.items()}