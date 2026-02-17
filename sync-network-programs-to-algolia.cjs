/**
 * Sync network programs to Algolia with composite objectIDs
 * 
 * Usage: node sync-network-programs-to-algolia.cjs <networkId>
 * Example: node sync-network-programs-to-algolia.cjs shelcastertv
 */

const { algoliasearch } = require('algoliasearch');

const ALGOLIA_APP_ID = 'KF42QHSMVK';
const ALGOLIA_ADMIN_KEY = 'ffeec31de4c7756de61087c1c7ff57c8';
const ALGOLIA_INDEX_NAME = 'programs';
const API_BASE = 'https://td0dn99gi2.execute-api.us-east-1.amazonaws.com';

const networkId = process.argv[2];
if (!networkId) {
  console.error('Usage: node sync-network-programs-to-algolia.cjs <networkId>');
  process.exit(1);
}

async function fetchAllNetworkPrograms(networkId) {
  const programs = [];
  let lastKey = null;

  do {
    const url = new URL(`${API_BASE}/networks/${networkId}/programs`);
    url.searchParams.set('limit', '100');
    if (lastKey) url.searchParams.set('lastKey', lastKey);

    console.log(`Fetching: ${url.toString()}`);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
    const data = await res.json();

    const items = data.Items || data.data || data.result?.Items || [];
    programs.push(...items);
    lastKey = data.LastEvaluatedKey || null;

    console.log(`  Fetched ${items.length} programs (total: ${programs.length})`);
  } while (lastKey);

  return programs;
}

function transformForAlgolia(program, networkId) {
  return {
    objectID: `n_${networkId}_${program.programId}`,
    programId: program.programId,
    title: program.title || 'Untitled Program',
    description: program.description || '',
    broadcast_type: program.broadcast_type || 'Video mp4',
    premium: program.premium || false,
    tags: program.tags || [],
    price: program.price,
    frequency: program.frequency,
    created_date: program.created_date || program.dateCreated || program.createdAt,
    groupId: program.groupId || 'General',
    groupName: program.groupName || program.groupId || 'General',
    program_url: program.program_url,
    program_image: program.program_image,
    imageFiles: program.imageFiles || [],
    mediaFiles: program.mediaFiles || [],
    duration: program.duration,
    networkId: networkId,
    userId: program.ownerId || null,
    created_timestamp: new Date(program.created_date || program.dateCreated || program.createdAt || '1900-01-01').getTime()
  };
}

async function main() {
  console.log(`\nSyncing network "${networkId}" programs to Algolia...\n`);

  const programs = await fetchAllNetworkPrograms(networkId);
  console.log(`\nTotal programs fetched: ${programs.length}\n`);

  if (programs.length === 0) {
    console.log('No programs found. Nothing to sync.');
    return;
  }

  const client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY);
  const algoliaRecords = programs.map(p => transformForAlgolia(p, networkId));

  console.log(`Indexing ${algoliaRecords.length} records to Algolia...`);
  await client.saveObjects({ indexName: ALGOLIA_INDEX_NAME, objects: algoliaRecords });

  console.log(`\nDone! Indexed ${algoliaRecords.length} network programs.`);
  console.log('Sample objectID:', algoliaRecords[0]?.objectID);
}

main().catch(console.error);