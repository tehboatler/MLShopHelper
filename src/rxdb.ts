import { createRxDatabase, addRxPlugin, RxDatabase } from 'rxdb';
import { replicateAppwrite } from 'rxdb/plugins/replication-appwrite';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { wrappedValidateAjvStorage, getAjv } from 'rxdb/plugins/validate-ajv';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';

// Add plugins
addRxPlugin(RxDBDevModePlugin);
addRxPlugin(RxDBQueryBuilderPlugin);

// Register the date-time format with Ajv
const ajv = getAjv();
ajv.addFormat('date-time', {
  type: 'string',
  validate: (v: string) => !isNaN(Date.parse(v))
});

// Use Ajv schema validation wrapper for Dexie storage
const storage = wrappedValidateAjvStorage({
  storage: getRxStorageDexie()
});

// Item schema
export const itemSchema = {
  title: 'item schema',
  version: 0,
  description: 'describes an inventory item',
  type: 'object',
  primaryKey: 'id',
  properties: {
    id: { type: 'string', maxLength: 128 },
    name: { type: 'string' },
    current_selling_price: { type: 'number' },
    notes: { type: ['string', 'null'] },
    owned: { type: 'boolean' },
    // ...other fields as needed
  },
  required: ['id', 'name', 'current_selling_price'],
};

// Price history schema
export const priceHistorySchema = {
  title: 'price history schema',
  version: 0,
  description: 'describes a price history entry',
  type: 'object',
  primaryKey: 'id',
  properties: {
    id: { type: 'string', maxLength: 128 },
    itemId: { type: 'string' },
    price: { type: 'number' },
    date: { type: 'string', format: 'date-time' },
    author: { type: 'string' },
    author_ign: { type: ['string', 'null'] },
    sold: { type: 'boolean' },
    item_name: { type: ['string', 'null'] },
    downvotes: { type: 'array', items: { type: 'string' }, default: [] },
    _deleted: { type: 'boolean', default: false }, // <-- use _deleted for RxDB/Appwrite replication
  },
  required: ['id', 'itemId', 'price', 'date'],
  additionalProperties: false, // keep strict
} as const;

// Database instance singleton
let dbPromise: Promise<RxDatabase> | null = null;

export async function getDb() {
  if (!dbPromise) {
    dbPromise = createRxDatabase({
      name: 'mlshophelper',
      storage, // <-- use the validated storage
      multiInstance: false,
      closeDuplicates: true, 
    }).then(async db => {
      // Add collections if not exist
      await db.addCollections({
        items: { schema: itemSchema },
        priceHistory: { schema: priceHistorySchema },
      });

      // --- Start Appwrite replication for priceHistory ---
      await replicatePriceHistorySandbox(db);
      return db;
    });
  }
  return dbPromise;
}

// --- Minimal sandboxed Appwrite replication for priceHistory ---
export async function replicatePriceHistorySandbox(db: RxDatabase) {
  const { VITE_APPWRITE_DATABASE, VITE_APPWRITE_PRICE_HISTORY_COLLECTION } = import.meta.env;
  const { client } = await import('./lib/appwrite');
  return replicateAppwrite({
    replicationIdentifier: 'price-history-replication-sandbox',
    client,
    databaseId: VITE_APPWRITE_DATABASE,
    collectionId: VITE_APPWRITE_PRICE_HISTORY_COLLECTION,
    deletedField: '_deleted',
    collection: db.priceHistory,
    pull: {
      batchSize: 1000,
      modifier: doc => {
        if (doc.$id && !doc.id) doc.id = doc.$id;
        return doc;
      },
    },
    // No push config: one-way sync only
    live: true,
    retryTime: 5000,
  });
}
