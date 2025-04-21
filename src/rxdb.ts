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

// Item stats schema
export const itemStatsSchema = {
  title: 'item stats schema',
  version: 0,
  description: 'describes stats for an item',
  type: 'object',
  primaryKey: 'itemId',
  properties: {
    itemId: { type: 'string', maxLength: 128 },
    p25: { type: ['number', 'null'] },
    median: { type: ['number', 'null'] },
    avg: { type: ['number', 'null'] },
    p75: { type: ['number', 'null'] },
    updatedAt: { type: 'string', format: 'date-time' },
    _deleted: { type: 'boolean', default: false },
  },
  required: ['itemId'],
  additionalProperties: false,
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
        itemStats: { schema: itemStatsSchema }, // <-- add itemStats
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

// --- Compute and update itemStats from priceHistory ---
export async function updateAllItemStats() {
  const db = await getDb();
  const priceHistory = await db.priceHistory.find().exec();
  console.log('[itemStats] priceHistory entries:', priceHistory.length, priceHistory);
  const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC

  // Get all current itemStats for quick lookup
  const currentStatsArr = await db.itemStats.find().exec();
  console.log('[itemStats] current itemStats before update:', currentStatsArr.length, currentStatsArr);
  const currentStatsMap = new Map<string, any>(
    currentStatsArr.map(stat => [stat.itemId, stat])
  );

  const grouped = priceHistory.reduce((acc: Record<string, number[]>, entry: any) => {
    if (!acc[entry.itemId]) acc[entry.itemId] = [];
    acc[entry.itemId].push(entry.price);
    return acc;
  }, {} as Record<string, number[]>);
  console.log('[itemStats] grouped priceHistory by itemId:', grouped);

  for (const [itemId, prices] of Object.entries(grouped)) {
    if (!Array.isArray(prices) || !prices.length) continue;
    const existing = currentStatsMap.get(itemId);
    const lastUpdated = existing?.updatedAt ? existing.updatedAt.slice(0, 10) : null;
    if (lastUpdated === todayStr) {
      console.log(`[itemStats] Skipping ${itemId} (already updated today)`);
      continue; // Already updated today
    }
    const sorted = prices.slice().sort((a: number, b: number) => a - b);
    const avg = sorted.reduce((a: number, b: number) => a + b, 0) / sorted.length;
    const p25 = percentile(sorted, 0.25);
    const median = percentile(sorted, 0.5);
    const p75 = percentile(sorted, 0.75);
    const upserted = {
      itemId,
      p25,
      median,
      avg,
      p75,
      updatedAt: new Date().toISOString(),
    };
    console.log(`[itemStats] Upserting for ${itemId}:`, upserted);
    await db.itemStats.upsert(upserted);
  }

  // Log after update
  const afterStatsArr = await db.itemStats.find().exec();
  console.log('[itemStats] itemStats after update:', afterStatsArr.length, afterStatsArr);
}

function percentile(arr: number[], p: number): number | null {
  if (!arr.length) return null;
  const idx = (arr.length - 1) * p;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return arr[lower];
  return arr[lower] + (arr[upper] - arr[lower]) * (idx - lower);
}
