import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "us-east-1" });
const docClient = DynamoDBDocumentClient.from(client);

// You'll need to provide these values
const userId = process.argv[2]; // Pass as first argument
const groupId = process.argv[3]; // Pass as second argument

if (!userId || !groupId) {
  console.error('Usage: node check-group-programs.mjs <userId> <groupId>');
  console.error('Example: node check-group-programs.mjs user123 group456');
  process.exit(1);
}

async function checkGroupPrograms() {
  try {
    console.log('Querying DynamoDB for group programs...');
    console.log('User ID:', userId);
    console.log('Group ID:', groupId);
    console.log('GSI1PK:', `u#${userId}#g#${groupId}`);
    console.log('---');

    const params = {
      TableName: "shelcaster-app",
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk AND begins_with(GSI1SK, :gsi1sk)",
      ExpressionAttributeValues: {
        ":gsi1pk": `u#${userId}#g#${groupId}`,
        ":gsi1sk": "p#",
      },
    };

    const command = new QueryCommand(params);
    const result = await docClient.send(command);

    console.log('Query Results:');
    console.log('Count:', result.Count);
    console.log('ScannedCount:', result.ScannedCount);
    console.log('---');
    
    if (result.Items && result.Items.length > 0) {
      console.log('Programs found:');
      result.Items.forEach((item, index) => {
        console.log(`\n${index + 1}. Program ID: ${item.programId || 'N/A'}`);
        console.log(`   Title: ${item.title || 'N/A'}`);
        console.log(`   GSI1PK: ${item.GSI1PK}`);
        console.log(`   GSI1SK: ${item.GSI1SK}`);
        console.log(`   Duration: ${item.duration || 'N/A'}`);
        console.log(`   URL: ${item.program_url || 'N/A'}`);
      });
    } else {
      console.log('No programs found in this group.');
    }

    console.log('\n---');
    console.log('Full result object:');
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('Error querying DynamoDB:', error);
    throw error;
  }
}

checkGroupPrograms();

