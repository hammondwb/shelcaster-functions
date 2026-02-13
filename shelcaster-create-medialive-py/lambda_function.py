import boto3
import json
from datetime import datetime

medialive = boto3.client('medialive', region_name='us-east-1')
dynamodb = boto3.client('dynamodb', region_name='us-east-1')

TABLE_NAME = 'shelcaster-app'
MEDIALIVE_ROLE_ARN = 'arn:aws:iam::124355640062:role/MediaLiveAccessRole'
INPUT_SECURITY_GROUP_ID = '3617718'
S3_BUCKET = 'shelcaster-media-manager'

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
        
        # Get IVS ingest endpoint
        ivs_ingest = None
        if 'ivs' in session and 'M' in session['ivs']:
            ivs_data = session['ivs']['M']
            if 'programIngestEndpoint' in ivs_data and 'S' in ivs_data['programIngestEndpoint']:
                ivs_ingest = ivs_data['programIngestEndpoint']['S']
        
        if not ivs_ingest:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'IVS ingest endpoint not found'})
            }
        
        # Create RTMP input for host
        input_response = medialive.create_input(
            Name=f'shelcaster-input-{session_id}',
            Type='RTMP_PUSH',
            InputSecurityGroups=[INPUT_SECURITY_GROUP_ID],
            Destinations=[
                {'StreamName': f'host/{session_id}'}
            ]
        )
        
        input_id = input_response['Input']['Id']
        rtmp_url = input_response['Input']['Destinations'][0]['Url']
        
        # Create MediaLive channel
        channel_response = medialive.create_channel(
            Name=f'shelcaster-channel-{session_id}',
            RoleArn=MEDIALIVE_ROLE_ARN,
            InputAttachments=[{
                'InputId': input_id,
                'InputAttachmentName': 'host-input'
            }],
            Destinations=[
                {
                    'Id': 'ivs-destination',
                    'Settings': [{
                        'Url': ivs_ingest,
                        'StreamName': 'program'
                    }]
                },
                {
                    'Id': 's3-destination',
                    'Settings': [{
                        'Url': f's3://{S3_BUCKET}/recordings/{session_id}/recording.m3u8'
                    }]
                }
            ],
            EncoderSettings={
                'VideoDescriptions': [{
                    'Name': 'video_1080p',
                    'CodecSettings': {
                        'H264Settings': {
                            'Profile': 'HIGH',
                            'Level': 'H264_LEVEL_4_1',
                            'Bitrate': 5000000,
                            'RateControlMode': 'CBR'
                        }
                    },
                    'Width': 1920,
                    'Height': 1080
                }],
                'AudioDescriptions': [{
                    'Name': 'audio_aac',
                    'CodecSettings': {
                        'AacSettings': {
                            'Bitrate': 128000,
                            'CodingMode': 'CODING_MODE_2_0',
                            'SampleRate': 48000
                        }
                    }
                }],
                'OutputGroups': [
                    {
                        'Name': 'IVS Output',
                        'OutputGroupSettings': {
                            'RtmpOutputSettings': {}
                        },
                        'Outputs': [{
                            'OutputName': 'ivs-output',
                            'VideoDescriptionName': 'video_1080p',
                            'AudioDescriptionNames': ['audio_aac'],
                            'OutputSettings': {
                                'RtmpOutputSettings': {
                                    'Destination': {'DestinationRefId': 'ivs-destination'}
                                }
                            }
                        }]
                    },
                    {
                        'Name': 'S3 Recording',
                        'OutputGroupSettings': {
                            'HlsOutputSettings': {
                                'HlsSettings': {
                                    'StandardHlsSettings': {
                                        'M3u8Settings': {}
                                    }
                                }
                            }
                        },
                        'Outputs': [{
                            'OutputName': 's3-output',
                            'VideoDescriptionName': 'video_1080p',
                            'AudioDescriptionNames': ['audio_aac'],
                            'OutputSettings': {
                                'HlsOutputSettings': {
                                    'HlsSettings': {
                                        'StandardHlsSettings': {
                                            'M3u8Settings': {}
                                        }
                                    },
                                    'NameModifier': '_recording'
                                }
                            }
                        }]
                    }
                ],
                'TimecodeConfig': {
                    'Source': 'EMBEDDED'
                }
            },
            ChannelClass='SINGLE_PIPELINE'
        )
        
        channel_id = channel_response['Channel']['Id']
        
        # Update DynamoDB with MediaLive info
        dynamodb.update_item(
            TableName=TABLE_NAME,
            Key={
                'pk': {'S': f'session#{session_id}'},
                'sk': {'S': 'info'}
            },
            UpdateExpression='SET mediaLive = :ml, updatedAt = :now',
            ExpressionAttributeValues={
                ':ml': {
                    'M': {
                        'channelId': {'S': channel_id},
                        'inputId': {'S': input_id},
                        'rtmpUrl': {'S': rtmp_url}
                    }
                },
                ':now': {'S': datetime.utcnow().isoformat()}
            }
        )
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'message': 'MediaLive channel created',
                'channelId': channel_id,
                'inputId': input_id,
                'rtmpUrl': rtmp_url
            })
        }
        
    except Exception as error:
        print(f'Error creating MediaLive channel: {str(error)}')
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': str(error)})
        }
