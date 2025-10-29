import { DynamoDBClient, BatchWriteItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";

const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" });
const TABLE_NAME = "shelcaster-app";

export const handler = async (event) => {
  const { networkId, channelId } = event.pathParameters;
  const { startIndex, endIndex } = event.queryStringParameters || {};
  return event;
  try {
    if (!startIndex || !endIndex || +startIndex < 0 || +startIndex > +endIndex) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "startIndex and endIndex are required" }),
      };
    }

    const formatDate = (dateStr) => dateStr.replace(/[-:]/g, '').slice(0, 13).replace('.', '');
    const formatTitle = rawTitle => rawTitle.replace(/'s|\./g, '').replace(/\bA\s?capella\b/gi, 'acapella').replace(/\s+/g, '-').toLowerCase();

    const rssURL = "https://www.blogtalkradio.com/gospellightradioshow.rss";

    const response = await fetch(rssURL);
    const xml = await response.text();
    const rssData = await parseStringPromise(xml);
    const items = rssData.rss.channel[0].item;

    const formattedItems = items.slice(+startIndex, +endIndex).map((item, index) => {
      const datePrefix = formatDate(new Date(item.pubDate[0]).toISOString() ?? new Date().toISOString())
      const rawTitle = item?.title[0];
      const rawTitleText = rawTitle.replace(/\s*\(.*$/, '');
      const episodeNumberMatch = rawTitle?.match(/\((.*?)\)/)?.[1]?.match(/\d+/g) ? rawTitle?.match(/\((.*?)\)/)?.[1]?.match(/\d+/g)[0] : `special-edition-${index}`;
      const formattedTitle = rawTitleText?.replace(/\s+/g, '-').toLowerCase()
      const programId = `${datePrefix}-ep-${formattedTitle}-${episodeNumberMatch}`;
      const cleanedPlaylistId = rawTitle?.includes("Stevie") ? formatTitle(formattedTitle) : formattedTitle;
      const fileUrl = item.enclosure[0]?.$.url ?? "";

      return {
        pk: `n#${networkId}#ch#${channelId}#pl#${cleanedPlaylistId}`,
        sk: `p#${programId}`,
        entityType: "network#playlist#program",
        GSI1PK: `p#${programId}`,
        GSI1SK: `n#${networkId}#ch#${channelId}#pl#${cleanedPlaylistId}`,
        networkId,
        channelId,
        playlistId: cleanedPlaylistId,
        programId,
        episodeNumber: episodeNumberMatch,
        title: item.title[0] ?? `ep-${episodeNumberMatch}`,
        fileUrl,
        date: item.pubDate[0] ?? "",
        description: item.description[0] ?? "",
        category: "religion",
        itunes: {
          duration: item["itunes:duration"]?.[0] ?? "",
          author: item["itunes:author"]?.[0] ?? "",
          subtitle: item["itunes:subtitle"]?.[0] ?? "",
          keywords: item["itunes:keywords"]?.[0] ?? "",
          explicit: item["itunes:explicit"]?.[0] ?? "",
          season: item["itunes:season"]?.[0] ?? "",
          episode: item["itunes:episode"]?.[0] ?? "",
          episodeType: item["itunes:episodeType"]?.[0] ?? "",
        },
      };
    });

    const batchWriteToDynamoDB = async (items) => {
      const chunkSize = 25;
      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        let unprocessedItems = chunk;

        do {
          const putRequests = unprocessedItems.map((item) => ({
            PutRequest: {
              Item: marshall(item),
            },
          }));

          const params = {
            RequestItems: {
              [TABLE_NAME]: putRequests,
            },
          };

          const response = await dynamoDBClient.send(new BatchWriteItemCommand(params));
          unprocessedItems = response.UnprocessedItems[TABLE_NAME]?.map((unprocessed) => {
            return unmarshall(unprocessed.PutRequest.Item);
          }) || [];
        } while (unprocessedItems.length > 0);
      }
    };

    const uniqueItems = [...new Map(formattedItems.map(item => [item.pk + item.sk, item])).values()];

    await batchWriteToDynamoDB(uniqueItems);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "All items successfully written to DynamoDB.",
        numberOfItemsProcessed: uniqueItems.length,
        rangeOfItems: { startIndex, endIndex },
      }),
    };
  } catch (error) {
    console.error("Error processing RSS feed:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};