// import { DynamoDBClient, BatchWriteItemCommand } from "@aws-sdk/client-dynamodb";
// import { marshall } from "@aws-sdk/util-dynamodb";

// const ddbClient = new DynamoDBClient();
// const TABLE_NAME = "shelcaster-app";

// const headers = {
//   'Content-Type': 'application/json',
//   'Access-Control-Allow-Origin': '*',
//   'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
//   'Access-Control-Allow-Headers': '*',
// };

// export const handler = async (event) => {
//   const { networkId, channelId } = event.pathParameters;
//   const { categoriesItems } = JSON.parse(event.body);
//   const someCategoriesHaveNoID = categoriesItems.some((cat) => !cat.categoryId);

//   if (!networkId || !channelId || !Array.isArray(categoriesItems) || someCategoriesHaveNoID) {
//     return {
//       statusCode: 400,
//       headers,
//       body: JSON.stringify({ error: "Invalid networkId, channelId, or categoriesItems data." }),
//     };
//   }

//   if (categoriesItems?.length > 10) {
//     return {
//       statusCode: 400,
//       headers,
//       body: JSON.stringify({ error: "Network categories are limited to 10 items at a time." }),
//     };
//   }

//   try {
//     const writeRequests = categoriesItems.map((category) => ({
//       PutRequest: {
//         Item: marshall({
//           pk: `n#${networkId}#channel-category`,
//           sk: `cat#${category.categoryId}#ch#${channelId}`,
//           entityType: "channel-category",
//           categoryId: category.categoryId,
//           ...category,
//         }),
//       },
//     }));

//     const command = new BatchWriteItemCommand({
//       RequestItems: {
//         [TABLE_NAME]: writeRequests,
//       },
//     });

//     await ddbClient.send(command);

//     return {
//       statusCode: 200,
//       headers,
//       body: JSON.stringify({ message: "Channel category items were created successfully." }),
//     };
//   } catch (error) {
//     console.error(error);
//     return {
//       statusCode: 500,
//       headers,
//       body: JSON.stringify({ error: "Failed to create items." }),
//     };
//   }
// };