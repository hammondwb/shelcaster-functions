import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";

const s3Client = new S3Client({ region: "us-east-1" });
const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" });

const BUCKET = "shelcaster-media-manager";

export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  try {
    const { showId } = event.pathParameters;
    const { fileName, fileType } = JSON.parse(event.body);

    if (!fileName || !fileType) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "fileName and fileType are required" }),
      };
    }

    // Generate S3 key
    const timestamp = Date.now();
    const key = `shows/${showId}/images/${timestamp}-${fileName}`;

    // Generate presigned URL for upload
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
    const imageUrl = `https://d2kyyx47f0bavc.cloudfront.net/${key}`;

    // Update show with image URL
    await dynamoDBClient.send(new UpdateItemCommand({
      TableName: "shelcaster-app",
      Key: marshall({
        pk: `show#${showId}`,
        sk: 'info',
      }),
      UpdateExpression: 'SET showImageUrl = :url, updatedAt = :now',
      ExpressionAttributeValues: marshall({
        ':url': imageUrl,
        ':now': new Date().toISOString()
      })
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        uploadUrl,
        imageUrl,
        key
      }),
    };
  } catch (error) {
    console.error('Error generating upload URL:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Failed to generate upload URL",
        error: error.message,
      }),
    };
  }
};
