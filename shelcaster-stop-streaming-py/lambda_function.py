import boto3
import json
from datetime import datetime

ivs = boto3.client('ivs', region_name='us-east-1')
medialive = boto3.client('medialive', region_name='us-east-1')
dynamodb = boto3.client('dynamodb', region_name='us-east-1')

TABLE_NAME = 'shelcaster-app'

def lambda_handler(event, context):
    print('Event:', json.dumps(event))
    
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*'
    }
    
    try:
        session_id = event.get('pathParameters', {}).get('sessionId')
        
        if not session_id:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'Missing sessionId'})
            }
        
        # Get session from DynamoDB
        response = dynamodb.get_item(
            TableName=TABLE_NAME,
            Key={
                'pk': {'S': f'session#{session_id}'},
                'sk': {'S': 'info'}
            }
        )
        
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({'error': 'Session not found'})
            }
        
        session = response['Item']
        
        # Stop MediaLive channel if exists
        if 'mediaLive' in session and 'M' in session['mediaLive']:
            ml_data = session['mediaLive']['M']
            if 'channelId' in ml_data and 'S' in ml_data['channelId']:
                channel_id = ml_data['channelId']['S']
                try:
                    medialive.stop_channel(ChannelId=channel_id)
                    print(f'MediaLive channel stopped: {channel_id}')
                except Exception as e:
                    if 'ConflictException' not in str(e):
                        print(f'MediaLive stop warning: {str(e)}')
                    else:
                        print('MediaLive channel already stopped')
        
        # Stop IVS channel if exists
        if 'ivs' in session and 'M' in session['ivs']:
            ivs_data = session['ivs']['M']
            if 'programChannelArn' in ivs_data and 'S' in ivs_data['programChannelArn']:
                channel_arn = ivs_data['programChannelArn']['S']
                try:
                    ivs.stop_channel(arn=channel_arn)
                    print(f'IVS channel stopped: {channel_arn}')
                except Exception as e:
                    print(f'IVS stop warning: {str(e)}')
        
        # Update DynamoDB
        dynamodb.update_item(
            TableName=TABLE_NAME,
            Key={
                'pk': {'S': f'session#{session_id}'},
                'sk': {'S': 'info'}
            },
            UpdateExpression='SET streaming.isLive = :live, updatedAt = :now',
            ExpressionAttributeValues={
                ':live': {'BOOL': False},
                ':now': {'S': datetime.utcnow().isoformat()}
            }
        )
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'message': 'Streaming stopped'})
        }
        
    except Exception as error:
        print(f'Error stopping streaming: {str(error)}')
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': str(error)})
        }
