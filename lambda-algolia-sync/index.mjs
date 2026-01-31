/**
 * DynamoDB Stream to Algolia Sync Lambda
 * 
 * This Lambda function is triggered by DynamoDB Streams when records are
 * inserted, modified, or deleted. It syncs program changes to Algolia.
 */

import { algoliasearch } from 'algoliasearch';

const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID || 'KF42QHSMVK';
const ALGOLIA_ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY;
const ALGOLIA_INDEX_NAME = 'programs';

// Initialize Algolia client
let algoliaClient;

function getAlgoliaClient() {
  if (!algoliaClient) {
    if (!ALGOLIA_ADMIN_KEY) {
      throw new Error('ALGOLIA_ADMIN_KEY environment variable is required');
    }
    algoliaClient = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY);
  }
  return algoliaClient;
}

// Check if this is a program record based on partition key pattern
function isProgramRecord(pk) {
  return pk && pk.includes('#programs');
}

// Extract userId from partition key (format: u#<userId>#programs)
function extractUserId(pk) {
  if (!pk) return null;
  const parts = pk.split('#');
  return parts[1] || null;
}

// Convert DynamoDB record to Algolia object
function transformToAlgoliaObject(record, userId) {
  return {
    objectID: record.programId,
    programId: record.programId,
    title: record.title || 'Untitled Program',
    description: record.description || '',
    broadcast_type: record.broadcast_type || 'Video mp4',
    premium: record.premium || false,
    tags: record.tags || [],
    price: record.price,
    frequency: record.frequency,
    created_date: record.created_date || record.dateCreated || record.createdAt,
    groupId: record.groupId || 'General',
    groupName: record.groupName || record.groupId || 'General',
    program_url: record.program_url,
    program_image: record.program_image,
    imageFiles: record.imageFiles || [],
    mediaFiles: record.mediaFiles || [],
    duration: record.duration,
    userId: userId,
    created_timestamp: new Date(record.created_date || record.dateCreated || record.createdAt || '1900-01-01').getTime()
  };
}

// Unmarshal DynamoDB record
function unmarshalRecord(image) {
  if (!image) return null;
  
  const result = {};
  for (const [key, value] of Object.entries(image)) {
    if (value.S !== undefined) result[key] = value.S;
    else if (value.N !== undefined) result[key] = Number(value.N);
    else if (value.BOOL !== undefined) result[key] = value.BOOL;
    else if (value.L !== undefined) result[key] = value.L.map(v => v.S || v.N || v.BOOL);
    else if (value.M !== undefined) result[key] = unmarshalRecord(value.M);
    else if (value.NULL !== undefined) result[key] = null;
    else result[key] = value;
  }
  return result;
}

export const handler = async (event) => {
  console.log('DynamoDB Stream event received:', JSON.stringify(event, null, 2));
  
  const client = getAlgoliaClient();
  const toSave = [];
  const toDelete = [];
  
  for (const record of event.Records) {
    const eventName = record.eventName; // INSERT, MODIFY, REMOVE
    const newImage = record.dynamodb?.NewImage;
    const oldImage = record.dynamodb?.OldImage;
    
    // Get the partition key to check if this is a program record
    const pk = newImage?.pk?.S || oldImage?.pk?.S;
    
    if (!isProgramRecord(pk)) {
      console.log('Skipping non-program record:', pk);
      continue;
    }
    
    const userId = extractUserId(pk);
    
    if (eventName === 'INSERT' || eventName === 'MODIFY') {
      const data = unmarshalRecord(newImage);
      if (data && data.programId) {
        const algoliaObject = transformToAlgoliaObject(data, userId);
        toSave.push(algoliaObject);
        console.log(`Queued ${eventName} for program:`, data.programId);
      }
    } else if (eventName === 'REMOVE') {
      const data = unmarshalRecord(oldImage);
      if (data && data.programId) {
        toDelete.push(data.programId);
        console.log('Queued DELETE for program:', data.programId);
      }
    }
  }
  
  // Batch save to Algolia
  if (toSave.length > 0) {
    console.log(`Saving ${toSave.length} objects to Algolia...`);
    await client.saveObjects({ indexName: ALGOLIA_INDEX_NAME, objects: toSave });
    console.log('Save complete');
  }
  
  // Batch delete from Algolia
  if (toDelete.length > 0) {
    console.log(`Deleting ${toDelete.length} objects from Algolia...`);
    await client.deleteObjects({ indexName: ALGOLIA_INDEX_NAME, objectIDs: toDelete });
    console.log('Delete complete');
  }
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      saved: toSave.length,
      deleted: toDelete.length
    })
  };
};

