import boto3
import json
from datetime import datetime

ivs = boto3.client('ivs', region_name='us-east-1')
medialive = boto3.client('medialive', region_name='us-east-1')
dynamodb = boto3.client('dynamodb', region_name='us-east-1')

TABLE_NAME = 'shelcaster-app'
MEDIALIVE_ROLE_ARN = 'arn:aws:iam::124355640062:role/MediaLiveAccessRole'
INPUT_SECURITY_GROUP_ID = '3617718'
S3_BUCKET = 'shelcaster-media-manager'

def create_medialive_channel(session_id, ivs_ingest):
    """Create MediaLive channel with RTMP input and dual outputs"""
    # Create RTMP input
    input_response = medialive.create_input(
        Name=f'shelcaster-input-{session_id}',
        Type='RTMP_PUSH',
        InputSecurityGroups=[INPUT_SECURITY_GROUP_ID],
        Destinations=[{'StreamName': f'host/{session_id}'}]
    )
    
    input_id = input_response['Input']['Id']
    rtmp_url = input_response['Input']['Destinations'][0]['Url']
    
    # Create MediaLive channel
    channel_response = medialive.create_channel(
        Name=f'shelcaster-channel-{session_id}',
        RoleArn=MEDIALIVE_ROLE_ARN,
        ChannelClass='SINGLE_PIPELINE',
        InputSpecification={
            'Codec': 'AVC',
            'Resolution': 'HD',
            'MaximumBitrate': 'MAX_10_MBPS'
        },
        InputAttachments=[{
            'InputId': input_id,
            'InputAttachmentName': 'host-input',
            'InputSettings': {
                'SourceEndBehavior': 'CONTINUE'
            }
        }],
        Destinations=[
            {
                'Id': 'ivs-destination',
                'Settings': [{'Url': f'rtmps://{ivs_ingest}:443/app/', 'StreamName': 'live'}]
            },
            {
                'Id': 's3-destination',
                'Settings': [{'Url': f's3ssl://{S3_BUCKET}/recordings/{session_id}/index'}]
            }
        ],
        EncoderSettings={
            'AudioDescriptions': [{
                'Name': 'audio_aac',
                'AudioSelectorName': 'default',
                'CodecSettings': {
                    'AacSettings': {
                        'Bitrate': 128000,
                        'CodingMode': 'CODING_MODE_2_0',
                        'SampleRate': 48000
                    }
                }
            }],
            'VideoDescriptions': [{
                'Name': 'video_1080p',
                'CodecSettings': {
                    'H264Settings': {
                        'Profile': 'HIGH',
                        'Level': 'H264_LEVEL_4_1',
                        'Bitrate': 5000000,
                        'RateControlMode': 'CBR',
                        'FramerateNumerator': 30,
                        'FramerateDenominator': 1
                    }
                },
                'Width': 1920,
                'Height': 1080
            }],
            'OutputGroups': [
                {
                    'Name': 'RTMP',
                    'OutputGroupSettings': {
                        'RtmpGroupSettings': {
                            'AuthenticationScheme': 'COMMON',
                            'CacheFullBehavior': 'DISCONNECT_IMMEDIATELY',
                            'CacheLength': 30,
                            'CaptionData': 'ALL',
                            'RestartDelay': 15
                        }
                    },
                    'Outputs': [{
                        'OutputName': 'ivs-output',
                        'VideoDescriptionName': 'video_1080p',
                        'AudioDescriptionNames': ['audio_aac'],
                        'OutputSettings': {
                            'RtmpOutputSettings': {
                                'Destination': {'DestinationRefId': 'ivs-destination'},
                                'ConnectionRetryInterval': 2,
                                'NumRetries': 10
                            }
                        }
                    }]
                },
                {
                    'Name': 'HLS',
                    'OutputGroupSettings': {
                        'HlsGroupSettings': {
                            'Destination': {'DestinationRefId': 's3-destination'},
                            'HlsCdnSettings': {'HlsBasicPutSettings': {'ConnectionRetryInterval': 1, 'NumRetries': 10}},
                            'SegmentLength': 6,
                            'ManifestDurationFormat': 'INTEGER'
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
                                        'M3u8Settings': {
                                            'AudioFramesPerPes': 4,
                                            'PcrControl': 'PCR_EVERY_PES_PACKET'
                                        },
                                        'AudioRenditionSets': 'program_audio'
                                    }
                                },
                                'NameModifier': '_recording'
                            }
                        }
                    }]
                }
            ],
            'TimecodeConfig': {'Source': 'EMBEDDED'}
        }
    )
    
    return {
        'channelId': channel_response['Channel']['Id'],
        'inputId': input_id,
        'rtmpUrl': rtmp_url
    }

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
        print('Session:', json.dumps(session, default=str))
        
        # Check if MediaLive channel exists, create if not
        channel_id = None
        if 'mediaLive' in session and 'M' in session['mediaLive']:
            ml_data = session['mediaLive']['M']
            if 'channelId' in ml_data and 'S' in ml_data['channelId']:
                channel_id = ml_data['channelId']['S']
        
        if not channel_id:
            print('MediaLive channel not found, creating...')
            # Get or create IVS STANDARD channel for ingest
            ivs_ingest = None
            if 'ivs' in session and 'M' in session['ivs']:
                ivs_data = session['ivs']['M']
                if 'programIngestEndpoint' in ivs_data and 'S' in ivs_data['programIngestEndpoint']:
                    ivs_ingest = ivs_data['programIngestEndpoint']['S']
            
            # If no ingest endpoint, create STANDARD IVS channel
            if not ivs_ingest:
                print('Creating STANDARD IVS channel for MediaLive ingest...')
                ivs_channel = ivs.create_channel(
                    name=f'shelcaster-ingest-{session_id}',
                    type='STANDARD',
                    latencyMode='LOW'
                )
                ivs_ingest = f"rtmps://{ivs_channel['channel']['ingestEndpoint']}:443/app/"
                
                # Update session with ingest endpoint
                dynamodb.update_item(
                    TableName=TABLE_NAME,
                    Key={
                        'pk': {'S': f'session#{session_id}'},
                        'sk': {'S': 'info'}
                    },
                    UpdateExpression='SET ivs.programIngestEndpoint = :ingest, ivs.ingestChannelArn = :arn',
                    ExpressionAttributeValues={
                        ':ingest': {'S': ivs_ingest},
                        ':arn': {'S': ivs_channel['channel']['arn']}
                    }
                )
                print(f'STANDARD IVS channel created with ingest: {ivs_ingest}')
            
            # Create MediaLive channel
            ml_channel = create_medialive_channel(session_id, ivs_ingest)
            channel_id = ml_channel['channelId']
            
            # Update DynamoDB with MediaLive info
            dynamodb.update_item(
                TableName=TABLE_NAME,
                Key={
                    'pk': {'S': f'session#{session_id}'},
                    'sk': {'S': 'info'}
                },
                UpdateExpression='SET mediaLive = :ml',
                ExpressionAttributeValues={
                    ':ml': {
                        'M': {
                            'channelId': {'S': ml_channel['channelId']},
                            'inputId': {'S': ml_channel['inputId']},
                            'rtmpUrl': {'S': ml_channel['rtmpUrl']}
                        }
                    }
                }
            )
            print(f'MediaLive channel created: {channel_id}')
        
        # Start MediaLive channel
        try:
            medialive.start_channel(ChannelId=channel_id)
            print(f'MediaLive channel started: {channel_id}')
        except Exception as e:
            if 'ConflictException' not in str(e):
                raise
            print('MediaLive channel already running')
        
        # Start IVS channel if exists
        if 'ivs' in session and 'M' in session['ivs']:
            ivs_data = session['ivs']['M']
            if 'programChannelArn' in ivs_data and 'S' in ivs_data['programChannelArn']:
                channel_arn = ivs_data['programChannelArn']['S']
                try:
                    ivs.start_channel(arn=channel_arn)
                    print(f'IVS channel started: {channel_arn}')
                except Exception as e:
                    print(f'IVS start warning: {str(e)}')
        
        # Update DynamoDB
        dynamodb.update_item(
            TableName=TABLE_NAME,
            Key={
                'pk': {'S': f'session#{session_id}'},
                'sk': {'S': 'info'}
            },
            UpdateExpression='SET streaming.isLive = :live, streaming.startedAt = :now, updatedAt = :now',
            ExpressionAttributeValues={
                ':live': {'BOOL': True},
                ':now': {'S': datetime.utcnow().isoformat()}
            }
        )
        
        # Get playback URL
        playback_url = None
        if 'ivs' in session and 'M' in session['ivs']:
            ivs_data = session['ivs']['M']
            if 'programPlaybackUrl' in ivs_data and 'S' in ivs_data['programPlaybackUrl']:
                playback_url = ivs_data['programPlaybackUrl']['S']
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'message': 'Streaming started',
                'playbackUrl': playback_url
            })
        }
        
    except Exception as error:
        print(f'Error starting streaming: {str(error)}')
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': str(error)})
        }
