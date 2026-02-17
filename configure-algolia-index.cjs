/**
 * Configure Algolia index settings
 * 
 * This sets up:
 * - Searchable attributes (title, description)
 * - Filterable attributes (userId, networkId, groupName, groupId, broadcast_type)
 * - Sortable attributes (created_timestamp, title)
 */

const { algoliasearch } = require('algoliasearch');

const ALGOLIA_APP_ID = 'KF42QHSMVK';
const ALGOLIA_ADMIN_KEY = 'ffeec31de4c7756de61087c1c7ff57c8';
const ALGOLIA_INDEX_NAME = 'programs';

async function configureIndex() {
  console.log('Configuring Algolia index settings...\n');

  const client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY);

  const settings = {
    // Attributes to search on
    searchableAttributes: [
      'title',
      'description',
      'groupName',
      'tags'
    ],
    
    // Attributes that can be used for filtering
    attributesForFaceting: [
      'filterOnly(userId)',      // filterOnly = can filter but not display as facet
      'filterOnly(networkId)',   // Filter by network for vista-stream playlist manager
      'groupName',               // Regular facet = can filter AND display with counts
      'groupId',
      'broadcast_type',
      'premium'
    ],
    
    // Custom ranking (newest first by default)
    customRanking: [
      'desc(created_timestamp)'
    ],
    
    // Attributes to retrieve
    attributesToRetrieve: [
      'objectID',
      'programId',
      'title',
      'description',
      'broadcast_type',
      'premium',
      'tags',
      'price',
      'frequency',
      'created_date',
      'groupId',
      'groupName',
      'program_url',
      'program_image',
      'userId',
      'networkId'
    ]
  };

  try {
    await client.setSettings({
      indexName: ALGOLIA_INDEX_NAME,
      indexSettings: settings
    });
    
    console.log('Index settings configured successfully!\n');
    console.log('Searchable attributes:', settings.searchableAttributes);
    console.log('Filterable attributes:', settings.attributesForFaceting);
    console.log('Custom ranking:', settings.customRanking);
    console.log('Attributes to retrieve:', settings.attributesToRetrieve);
  } catch (error) {
    console.error('Error configuring index:', error);
  }
}

configureIndex();