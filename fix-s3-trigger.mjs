import { S3Client, PutBucketNotificationConfigurationCommand, GetBucketNotificationConfigurationCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({ region: 'us-east-1' });
const BUCKET = 'shelcaster-media-manager';
const LAMBDA_ARN = 'arn:aws:lambda:us-east-1:124355640062:function:shelcaster-ivs-recording-processor';

async function fixS3Trigger() {
  console.log('\n========================================');
  console.log('Fix S3 Trigger for IVS Real-Time Recordings');
  console.log('========================================\n');

  try {
    // Get current configuration
    console.log('[1/2] Getting current S3 notification configuration...');
    const currentConfig = await s3Client.send(
      new GetBucketNotificationConfigurationCommand({ Bucket: BUCKET })
    );

    console.log('Current triggers:', JSON.stringify(currentConfig.LambdaFunctionConfigurations, null, 2));

    // Update configuration to listen for multivariant.m3u8 (IVS Real-Time)
    // AND master.m3u8 (IVS standard recordings)
    console.log('\n[2/2] Updating S3 notification configuration...');
    
    const newConfig = {
      Bucket: BUCKET,
      NotificationConfiguration: {
        LambdaFunctionConfigurations: [
          {
            Id: 'ivs-realtime-multivariant',
            LambdaFunctionArn: LAMBDA_ARN,
            Events: ['s3:ObjectCreated:*'],
            Filter: {
              Key: {
                FilterRules: [
                  {
                    Name: 'Suffix',
                    Value: 'multivariant.m3u8'
                  }
                ]
              }
            }
          },
          {
            Id: 'ivs-standard-master',
            LambdaFunctionArn: LAMBDA_ARN,
            Events: ['s3:ObjectCreated:*'],
            Filter: {
              Key: {
                FilterRules: [
                  {
                    Name: 'Suffix',
                    Value: 'master.m3u8'
                  }
                ]
              }
            }
          }
        ]
      }
    };

    await s3Client.send(new PutBucketNotificationConfigurationCommand(newConfig));

    console.log('  ✅ S3 trigger updated successfully');

    console.log('\n========================================');
    console.log('✅ Fix Complete!');
    console.log('========================================\n');
    console.log('S3 bucket now triggers Lambda for:');
    console.log('  - multivariant.m3u8 (IVS Real-Time compositions)');
    console.log('  - master.m3u8 (IVS standard recordings)');
    console.log('\nNext recording will automatically create program entry with program_url.\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    if (error.message.includes('Unable to validate')) {
      console.error('\nThe Lambda function needs permission to be invoked by S3.');
      console.error('Run this command to add permission:\n');
      console.error('aws lambda add-permission \\');
      console.error('  --function-name shelcaster-ivs-recording-processor \\');
      console.error('  --statement-id s3-invoke-multivariant \\');
      console.error('  --action lambda:InvokeFunction \\');
      console.error('  --principal s3.amazonaws.com \\');
      console.error('  --source-arn arn:aws:s3:::shelcaster-media-manager \\');
      console.error('  --profile shelcaster-admin --region us-east-1\n');
    }
    
    process.exit(1);
  }
}

fixS3Trigger();
