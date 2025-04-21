import { Client, Databases, Query } from 'node-appwrite';

// This Appwrite function will be executed every time your function is triggered
export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');
  const databases = new Databases(client);

  // ENV VARS: Set these in your Appwrite Function settings
  const DB_ID = process.env.VITE_APPWRITE_DATABASE;
  const ITEMS_COLLECTION_ID = process.env.VITE_APPWRITE_ITEMS_COLLECTION;
  const PRICE_HISTORY_COLLECTION_ID = process.env.VITE_APPWRITE_PRICE_HISTORY_COLLECTION;
  const STATS_COLLECTION_ID = process.env.VITE_APPWRITE_STATS_COLLECTION;

  // Runtime check for missing env vars
  if (!DB_ID || !ITEMS_COLLECTION_ID || !PRICE_HISTORY_COLLECTION_ID || !STATS_COLLECTION_ID) {
    const missing = [
      !DB_ID && 'VITE_APPWRITE_DATABASE',
      !ITEMS_COLLECTION_ID && 'VITE_APPWRITE_ITEMS_COLLECTION',
      !PRICE_HISTORY_COLLECTION_ID && 'VITE_APPWRITE_PRICE_HISTORY_COLLECTION',
      !STATS_COLLECTION_ID && 'VITE_APPWRITE_STATS_COLLECTION',
    ].filter(Boolean).join(', ');
    error(`[main] Fatal error: Missing required environment variables: ${missing}`);
    throw new Error(`[main] Fatal error: Missing required environment variables: ${missing}`);
  }

  // Helper: fetch all documents from a collection (paginated)
  async function getAllDocuments(collectionId, query) {
    let docs = [];
    let cursor = undefined;
    let page = 0;
    do {
      log(`[getAllDocuments] Fetching page ${page} for collection ${collectionId} (cursor: ${cursor})`);
      let result;
      try {
        result = await databases.listDocuments(DB_ID, collectionId, [
          ...(query || []),
          ...(cursor ? [Query.cursorAfter(cursor)] : []),
          Query.limit(100),
        ]);
      } catch (err) {
        error(`[getAllDocuments] Error fetching page ${page} for collection ${collectionId}: ${err.message}`);
        throw err;
      }
      log(`[getAllDocuments] Got ${result.documents.length} docs on page ${page} for collection ${collectionId}`);
      docs = docs.concat(result.documents);
      cursor = result.documents.length ? result.documents[result.documents.length - 1].$id : undefined;
      page++;
    } while (cursor);
    log(`[getAllDocuments] Fetched total ${docs.length} docs from collection ${collectionId}`);
    return docs;
  }

  try {
    log(`[main] Starting price stats calculation at ${new Date().toISOString()}`);
    log(`[main] DB_ID=${DB_ID}, ITEMS_COLLECTION_ID=${ITEMS_COLLECTION_ID}, PRICE_HISTORY_COLLECTION_ID=${PRICE_HISTORY_COLLECTION_ID}, STATS_COLLECTION_ID=${STATS_COLLECTION_ID}`);
    // 1. Get all items
    const items = await getAllDocuments(ITEMS_COLLECTION_ID);
    log(`[main] Got ${items.length} items`);
    let updated = 0;
    for (const [i, item] of items.entries()) {
      log(`[main] Processing item ${i+1}/${items.length}: ${item.$id}`);
      // 2. Get all price history for this item
      const priceDocs = await getAllDocuments(PRICE_HISTORY_COLLECTION_ID, [Query.equal('itemId', item.$id)]);
      log(`[main] Item ${item.$id} has ${priceDocs.length} price history entries`);
      const prices = priceDocs.map(doc => doc.price).filter(p => typeof p === 'number');
      if (prices.length === 0) {
        log(`[main] Item ${item.$id} has no price entries, skipping`);
        continue;
      }
      prices.sort((a, b) => a - b);
      const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
      const median = prices.length % 2 === 1
        ? prices[Math.floor(prices.length / 2)]
        : (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2;
      const p25 = prices[Math.floor(prices.length * 0.25)];
      const p75 = prices[Math.floor(prices.length * 0.75)];
      // 3. Upsert stats document (use itemId as docId for easy lookup)
      try {
        log(`[main] Upserting stats doc for item ${item.$id}`);
        await databases.createDocument(
          DB_ID,
          STATS_COLLECTION_ID,
          item.$id,
          {
            itemId: item.$id,
            median,
            avg,
            p25,
            p75,
            count: prices.length,
            updatedAt: new Date().toISOString(),
          },
          [], // Permissions
          true // Overwrite if exists
        );
        log(`[main] Stats doc upserted for item ${item.$id}`);
        updated++;
      } catch (err) {
        error(`[main] Error upserting stats doc for item ${item.$id}: ${err.message}`);
      }
    }
    log(`[main] Finished processing. Updated ${updated} stats docs.`);
    return res.json({ status: 'ok', updated });
  } catch (err) {
    error('[main] Fatal error in median price stats function: ' + err.message);
    return res.json({ status: 'error', message: err.message });
  }
};
