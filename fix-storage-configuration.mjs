import { IVSRealTimeClient, CreateStorageConfigurationCommand, ListStorageConfigurationsCommand } from '@aws-sdk/client-ivs-realtime';
import { LambdaClient, UpdateFunctionConfigurationCommand, GetFunctionConfigurationCommand } from '@aws-sdk/client-lambda';

const ivsClient = new IVSRealTimeClient({ region: 'us-east-1' });
const lambdaClient = new LambdaClient({ region: 'us-east-1' });

const BUCKET = 'shelcaster-media-manager';
const FUNCTION_NAME = 'shelcaster-start-composition';

async function fixStorageConfiguration() {
  console.log('\n========================================');
  console.log('Fix IVS Real-Time Storage Configuration');
  console.log('========================================\n');

  try {
    // Step 1: List existing storage configurations
    console.log('[1/3] Checking existing storage configurations...');
    const listResponse = await ivsClient.send(new ListStorageConfigurationsCommand({}));
    
    let storageConfigArn = null;
    
    if (listResponse.storageConfigurations && listResponse.storageConfigurations.length > 0) {
      const existing = listResponse.storageConfigurations.find(
        config => config.s3?.bucketName === BUCKET
      );
      
      if (existing) {
        console.log(`  ✅ Found existing configuration: ${existing.arn}`);
        storageConfigArn = existing.arn;
      }
    }

    // Step 2: Create new storage configuration if needed
    if (!storageConfigArn) {
      console.log('\n[2/3] Creating new storage configuration...');
      const createResponse = await ivsClient.send(new CreateStorageConfigurationCommand({
        name: `shelcaster-recordings-${Date.now()}`,
        s3: {
          bucketName: BUCKET
        }
      }));
      
      storageConfigArn = createResponse.storageConfiguration.arn;
      console.log(`  ✅ Created: ${storageConfigArn}`);
    } else {
      console.log('\n[2/3] Using existing storage configuration');
    }

    // Step 3: Update Lambda environment variable
    console.log('\n[3/3] Updating Lambda environment variable...');
    
    const getFunctionResponse = await lambdaClient.send(
      new GetFunctionConfigurationCommand({ FunctionName: FUNCTION_NAME })
    );
    
    const currentEnv = getFunctionResponse.Environment?.Variables || {};
    
    await lambdaClient.send(new UpdateFunctionConfigurationCommand({
      FunctionName: FUNCTION_NAME,
      Environment: {
        Variables: {
          ...currentEnv,
          STORAGE_CONFIGURATION_ARN: storageConfigArn
        }
      }
    }));
    
    console.log('  ✅ Lambda updated with new storage configuration ARN');

    console.log('\n========================================');
    console.log('✅ Fix Complete!');
    console.log('========================================\n');
    console.log('Storage Configuration ARN:', storageConfigArn);
    console.log('\nTest by starting a new composition.');
    console.log('Recordings should now save to S3 successfully.\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Verify S3 bucket policy allows ivs-composite.us-east-1.amazonaws.com');
    console.error('2. Check AWS credentials have IVS Real-Time permissions');
    console.error('3. Ensure bucket is in us-east-1 region\n');
    process.exit(1);
  }
}

fixStorageConfiguration();
