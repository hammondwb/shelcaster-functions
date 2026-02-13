import boto3
import json
from datetime import datetime

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
        
        # Get MediaLive channel ID
        channel_id = None
        if 'mediaLive' in session and 'M' in session['mediaLive']:
            ml_data = session['mediaLive']['M']
            if 'channelId' in ml_data and 'S' in ml_data['channelId']:
                channel_id = ml_data['channelId']['S']
        
        if not channel_id:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'MediaLive channel not found'})
            }
        
        # Create schedule action to enable S3 output
        action_name = f'start-recording-{session_id}'
        medialive.batch_update_schedule(
            ChannelId=channel_id,
            Creates={
                'ScheduleActions': [{
                    'ActionName': action_name,
                    'ScheduleActionStartSettings': {
                        'ImmediateMode': {}
                    },
                    'ScheduleActionSettings': {
                        'HlsOutputSettings': {
                            'HlsGroupSettings': {
                                'Destination': {
                                    'DestinationRefId': 's3-destination'
                                }
                            }
                        }
                    }
                }]
            }
        )
        
        # Update DynamoDB
        dynamodb.update_item(
            TableName=TABLE_NAME,
            Key={
                'pk': {'S': f'session#{session_id}'},
                'sk': {'S': 'info'}
            },
            UpdateExpression='SET recording.isRecording = :rec, recording.startedAt = :now, recording.actionName = :action, updatedAt = :now',
            ExpressionAttributeValues={
                ':rec': {'BOOL': True},
                ':action': {'S': action_name},
                ':now': {'S': datetime.utcnow().isoformat()}
            }
        )
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'message': 'Recording started'})
        }
        
    except Exception as error:
        print(f'Error starting recording: {str(error)}')
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': str(error)})
        }
