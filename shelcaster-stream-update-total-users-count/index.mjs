import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const dynamoDb = new DynamoDBClient();

export const handler = async (event) => {
  try {
    for (const record of event.Records) {
      if (!record.dynamodb || !record.eventName) continue;
      
      const newImage = record.dynamodb.NewImage ? unmarshall(record.dynamodb.NewImage) : null;
      const oldImage = record.dynamodb.OldImage ? unmarshall(record.dynamodb.OldImage) : null;
      
      let entityType = newImage?.entityType || oldImage?.entityType;
      if (!entityType || !entityType.startsWith("user")) continue;
      
      let increment = 0;
      if (record.eventName === "INSERT") {
        increment = 1;
      } else if (record.eventName === "REMOVE") {
        increment = -1;
      } else {
        continue;
      }
      
      await dynamoDb.send(new UpdateItemCommand({
        TableName: "shelcaster-app",
        Key: marshall({ pk: "admin", sk: "stats" }),
        UpdateExpression: "SET totalUsersCount = totalUsersCount + :inc",
        ExpressionAttributeValues: marshall({
          ":inc": increment
        })
      }));
    }
  } catch (error) {
    console.error("Error processing stream event", error);
  }
};
