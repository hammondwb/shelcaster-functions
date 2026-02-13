/**
 * Create IVS Real-Time Encoder Configuration
 */

import { IVSRealTimeClient, CreateEncoderConfigurationCommand } from "@aws-sdk/client-ivs-realtime";

const client = new IVSRealTimeClient({ region: "us-east-1" });

async function createEncoderConfig() {
  try {
    const response = await client.send(new CreateEncoderConfigurationCommand({
      name: "shelcaster-720p-30fps",
      video: {
        bitrate: 2500000,
        framerate: 30,
        height: 720,
        width: 1280
      }
    }));
    
    console.log('Encoder configuration created successfully!');
    console.log('ARN:', response.encoderConfiguration.arn);
    console.log('\nAdd this to your Lambda function:');
    console.log(`const ENCODER_CONFIG_ARN = '${response.encoderConfiguration.arn}';`);
    
    return response.encoderConfiguration.arn;
  } catch (error) {
    if (error.name === 'ConflictException') {
      console.log('Encoder configuration already exists');
      // List existing configs
      const { ListEncoderConfigurationsCommand } = await import("@aws-sdk/client-ivs-realtime");
      const list = await client.send(new ListEncoderConfigurationsCommand({}));
      console.log('\nExisting encoder configurations:');
      list.encoderConfigurations.forEach(config => {
        console.log(`- ${config.name}: ${config.arn}`);
      });
      return list.encoderConfigurations[0]?.arn;
    }
    throw error;
  }
}

createEncoderConfig().catch(console.error);
