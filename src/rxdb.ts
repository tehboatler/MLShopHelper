import { createRxDatabase, addRxPlugin, removeRxDatabase } from 'rxdb';
import type { RxDatabase } from 'rxdb';
import { replicateAppwrite } from 'rxdb/plugins/replication-appwrite';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { wrappedValidateAjvStorage, getAjv } from 'rxdb/plugins/validate-ajv';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';

// --- Auto-wipe RxDB IndexedDB if schema version changes ---
const APP_SCHEMA_VERSION = 1; // Increment this with any schema change
const DB_NAME = 'mlshophelper'; // This matches the name in createDb()
const lastVersion = parseInt(localStorage.getItem('app_schema_version') || '0', 10);
if (lastVersion !== APP_SCHEMA_VERSION) {
  removeRxDatabase(DB_NAME, getRxStorageDexie()).then(() => {
    localStorage.setItem('app_schema_version', APP_SCHEMA_VERSION.toString());
    window.location.reload();
  });
}

// Add plugins
addRxPlugin(RxDBDevModePlugin);
addRxPlugin(RxDBQueryBuilderPlugin);
addRxPlugin(RxDBMigrationSchemaPlugin);

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
  version: 1,
  description: 'describes an inventory item',
  type: 'object',
  primaryKey: 'id',
  properties: {
    id: { type: 'string', maxLength: 128 },
    name: { type: 'string' },
    price: { type: 'number' },
    owned: { type: 'boolean' },
    notes: { type: ['string', 'null'] },
    // ...other fields as needed
  },
  required: ['id', 'name', 'price'],
};

// Price history schema
export const priceHistorySchema = {
  title: 'price history schema',
  version: 1,
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
  version: 1,
  description: 'describes stats for an item',
  type: 'object',
  primaryKey: 'itemId',
  properties: {
    itemId: { type: 'string', maxLength: 128 },
    p25: { type: ['number', 'null'] },
    count: { type: 'number' },
    median: { type: ['number', 'null'] },
    avg: { type: ['number', 'null'] },
    p75: { type: ['number', 'null'] },
    updatedAt: { type: 'string', format: 'date-time' },
    _deleted: { type: 'boolean', default: false },
  },
  required: ['itemId'],
  additionalProperties: false,
} as const;

// Invite schema
export const inviteSchema = {
  title: 'invite schema',
  version: 1,
  description: 'describes a user invite',
  type: 'object',
  primaryKey: 'code',
  properties: {
    code: { type: 'string', maxLength: 32 },
    createdBy: { type: 'string' },
    usedBy: { type: ['string', 'null'] },
    status: { type: 'string', enum: ['redeemed', 'unredeemed', 'expired'] },
    createdAt: { type: 'string', format: 'date-time' },
    usedAt: { type: ['string', 'null'], format: 'date-time' },
    _deleted: { type: 'boolean', default: false },
  },
  required: ['code', 'createdBy', 'status', 'createdAt'],
  additionalProperties: false,
} as const;

interface ReplicateAppwriteCollectionOptions {
  db: RxDatabase;
  collectionName: string;
  replicationIdentifier: string;
  envCollectionVar: string;
}

// --- Generic Appwrite replication helper ---
export async function replicateAppwriteCollection({
  db,
  collectionName,
  replicationIdentifier,
  envCollectionVar,
}: ReplicateAppwriteCollectionOptions) {
  const { VITE_APPWRITE_DATABASE } = import.meta.env;
  const { client } = await import('./lib/appwrite');
  const collectionId = import.meta.env[envCollectionVar];
  return replicateAppwrite({
    replicationIdentifier,
    client,
    databaseId: VITE_APPWRITE_DATABASE,
    collectionId,
    deletedField: '_deleted',
    collection: db[collectionName],
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

// --- Minimal sandboxed Appwrite replication for priceHistory ---
export async function replicatePriceHistorySandbox(db: RxDatabase) {
  // Kept for backward compatibility; delegates to generic helper
  return replicateAppwriteCollection({
    db,
    collectionName: 'priceHistory',
    replicationIdentifier: 'price-history-replication-sandbox',
    envCollectionVar: 'VITE_APPWRITE_PRICE_HISTORY_COLLECTION',
  });
}

// --- Minimal sandboxed Appwrite replication for items ---
export async function replicateItemsAppwrite(db: RxDatabase) {
  // Kept for backward compatibility; delegates to generic helper
  return replicateAppwriteCollection({
    db,
    collectionName: 'items',
    replicationIdentifier: 'items-replication',
    envCollectionVar: 'VITE_APPWRITE_ITEMS_COLLECTION',
  });
}

// --- Minimal sandboxed Appwrite replication for itemStats ---
export async function replicateItemStatsAppwrite(db: RxDatabase) {
  // Kept for backward compatibility; delegates to generic helper
  return replicateAppwriteCollection({
    db,
    collectionName: 'itemStats',
    replicationIdentifier: 'item-stats-replication',
    envCollectionVar: 'VITE_APPWRITE_STATS_COLLECTION',
  });
}

// --- Minimal sandboxed Appwrite replication for invites ---
export async function replicateInvitesAppwrite(db: RxDatabase) {
  return replicateAppwriteCollection({
    db,
    collectionName: 'invites',
    replicationIdentifier: 'invites-replication',
    envCollectionVar: 'VITE_APPWRITE_INVITES_COLLECTION',
  });
}

// Database instance singleton
let dbPromise: Promise<RxDatabase> | null = null;

// --- DB epoch for RxDB instance tracking ---
let dbEpoch = 0;
export function getDbEpoch() { return dbEpoch; }

// Defensive: Actually create a new DB
async function createDb() {
  // (Move your db creation logic here from getDb)
  const db = await createRxDatabase({
    name: 'mlshophelper',
    storage,
    ignoreDuplicate: true,
    eventReduce: true,
    multiInstance: false, // Tauri: single instance
  });
  await db.addCollections({
    items: {
      schema: itemSchema,
      migrationStrategies: {
        1: (doc: any) => doc,
      },
    },
    priceHistory: {
      schema: priceHistorySchema,
      migrationStrategies: {
        1: (doc: any) => doc,
      },
    },
    itemStats: {
      schema: itemStatsSchema,
      migrationStrategies: {
        1: (doc: any) => doc,
      },
    },
    invites: {
      schema: inviteSchema,
      migrationStrategies: {
        1: (doc: any) => doc,
      },
    },
  });
  // Setup replication, etc.
  await replicateItemsAppwrite(db);
  await replicatePriceHistorySandbox(db);
  await replicateItemStatsAppwrite(db);
  await replicateInvitesAppwrite(db);
  return db;
}

// Add a closeDb function to allow reinitialization after login/logout
export async function closeDb() {
  if (!dbPromise) return;
  const db = await dbPromise;
  if (!db.isClosed) {
    await db.remove();
  }
  dbPromise = null;
  dbEpoch++; // Increment epoch so hooks re-subscribe
}

export async function getDb() {
  if (!dbPromise) {
    dbPromise = createDb();
  }
  let db: RxDatabase;
  try {
    db = await dbPromise;
  } catch (e) {
    // If creation fails, reset and rethrow
    dbPromise = null;
    throw e;
  }
  // Defensive: check if closed
  if (db.isClosed) {
    console.warn('[RxDB] DB was closed, recreating...');
    dbPromise = createDb();
    db = await dbPromise;
  }
  return db;
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

// --- Auto-update itemStats when priceHistory changes ---
getDb().then(db => {
  db.priceHistory.find().$.subscribe(async (docs) => {
    if (docs && docs.length > 0) {
      // Debounce: only run if at least 500ms since last call
      if (!(window as any)._lastStatsUpdate || Date.now() - (window as any)._lastStatsUpdate > 500) {
        (window as any)._lastStatsUpdate = Date.now();
        await updateAllItemStats();
      }
    }
  });
});

// --- Appwrite Realtime subscription for RxDB sync ---
import { client } from './lib/appwrite';

export function subscribeToAppwriteRealtimeForItems() {
  const databaseId = import.meta.env.VITE_APPWRITE_DATABASE!;
  const collectionId = import.meta.env.VITE_APPWRITE_ITEMS_COLLECTION!;
  getDb().then(db => {
    client.subscribe([
      `databases.${databaseId}.collections.${collectionId}.documents`
    ], async (response: any) => {
      const events = response.events as string[];
      const payload = response.payload;
      if (events.some(e => e.endsWith('.delete'))) {
        // Document deleted remotely: remove from RxDB
        const doc = await db.items.findOne(payload.$id).exec();
        if (doc) await doc.remove();
      } else if (events.some(e => e.endsWith('.create') || e.endsWith('.update'))) {
        // Document created/updated remotely: upsert into RxDB
        // Ensure the id field is set and sanitize Appwrite system fields
        const { $id, name, price, owned, notes } = payload;
        const item = {
          id: $id,
          name,
          price,
          owned,
          notes
        };
        if (db.items && typeof db.items.upsert === 'function') {
          await db.items.upsert(item);
        } else {
          console.error('[RxDB] db.items or db.items.upsert is undefined:', db.items);
        }
      }
    });
  });
}

// Call subscribeToAppwriteRealtimeForItems() once at app startup (e.g. in App.tsx)
