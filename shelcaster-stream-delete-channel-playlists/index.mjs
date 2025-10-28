import { DynamoDBClient, QueryCommand, BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const dynamoDBClient = new DynamoDBClient();

export const handler = async (event) => {
  try {
    for (const record of event.Records) {
      if (record.eventName !== 'REMOVE') continue;
      const oldImage = unmarshall(record.dynamodb.OldImage);
      const { pk, sk } = oldImage;

      if (!pk.startsWith('n#') || !sk.startsWith('ch#')) continue;

      const networkId = pk.split('#')[1];
      const channelId = sk.split('#')[1];

      const queryCommand = new QueryCommand({
        TableName: 'shelcaster-app',
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
        ExpressionAttributeValues: marshall({
          ':pk': `n#${networkId}#ch#${channelId}#playlists`,
          ':sk': 'pl#'
        }),
      });

      const { Items } = await dynamoDBClient.send(queryCommand);
      if (!Items || Items.length === 0) continue;

      const deleteRequests = Items.map(item => ({
        DeleteRequest: {
          Key: marshall({ pk: item.pk.S, sk: item.sk.S }),
        },
      }));

      while (deleteRequests.length) {
        const batch = deleteRequests.splice(0, 25);
        await dynamoDBClient.send(new BatchWriteItemCommand({
          RequestItems: { 'shelcaster-app': batch },
        }));
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Playlists deleted successfully' })
    };
  } catch (error) {
    console.error('Error deleting playlists:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error', error: error.message })
    };
  }
};
