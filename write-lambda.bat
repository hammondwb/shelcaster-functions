@echo off
(
echo import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
echo import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
echo.
echo const dynamoDBClient = new DynamoDBClient^({ region: "us-east-1" }^);
echo.
echo export const handler = async ^(event^) =^> {
echo   console.log^("Event received:", JSON.stringify^(event^)^);
echo.
echo   const headers = {
echo     'Content-Type': 'application/json',
echo     'Access-Control-Allow-Origin': '*',
echo     'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
echo     'Access-Control-Allow-Headers': '*',
echo   };
echo.
echo   try {
echo     console.log^("Path parameters:", JSON.stringify^(event.pathParameters^)^);
echo     const { tracklistId } = event.pathParameters ^|^| {};
echo.
echo     if ^(!tracklistId^) {
echo       return {
echo         statusCode: 400,
echo         headers,
echo         body: JSON.stringify^({ message: "Missing tracklistId parameter" }^),
echo       };
echo     }
echo.
echo     const params = {
echo       TableName: "shelcaster-app",
echo       KeyConditionExpression: "pk = :pk AND begins_with^(sk, :sk^)",
echo       ExpressionAttributeValues: marshall^({
echo         ":pk": `tracklist#${tracklistId}`,
echo         ":sk": "program#",
echo       }^),
echo       ScanIndexForward: true,
echo     };
echo.
echo     const result = await dynamoDBClient.send^(new QueryCommand^(params^)^);
echo.
echo     return {
echo       statusCode: 200,
echo       headers,
echo       body: JSON.stringify^({
echo         programs: result.Items ? result.Items.map^(^(item^) =^> unmarshall^(item^)^) : [],
echo       }^),
echo     };
echo   } catch ^(error^) {
echo     console.error^("Error getting tracklist programs:", error^);
echo     return {
echo       statusCode: 500,
echo       headers,
echo       body: JSON.stringify^({ message: "Internal server error", error: error.message }^),
echo     };
echo   }
echo };
) > shelcaster-get-tracklist-programs\index.mjs

