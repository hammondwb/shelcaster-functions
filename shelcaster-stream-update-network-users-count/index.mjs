import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const dynamoDb = new DynamoDBClient();

export const handler = async (event) => {
  try {
    for (const record of event.Records) {
      if (!record.dynamodb || !record.eventName) continue;
      
      const newImage = record.dynamodb.NewImage ? unmarshall(record.dynamodb.NewImage) : null;
      const oldImage = record.dynamodb.OldImage ? unmarshall(record.dynamodb.OldImage) : null;
      
      let pk = newImage?.pk || oldImage?.pk;
      let networkId = newImage?.networkId || oldImage?.networkId;
      if (!pk?.startsWith("up#")) continue;
      
      let increment = record.eventName === "INSERT" ? 1 : record.eventName === "REMOVE" ? -1 : 0;
      if (increment === 0) continue;
      
      await dynamoDb.send(new UpdateItemCommand({
        TableName: "shelcaster-app",
        Key: marshall({ pk: `n#${networkId}`, sk: "info" }),
        UpdateExpression: "SET totalUsersCount = totalUsersCount + :inc",
        ExpressionAttributeValues: marshall({ ":inc": increment })
      }));
    }
  } catch (error) {
    console.error("Error processing stream event", error);
  }
};
