import { Client, Databases } from 'node-appwrite';

// This Appwrite function will be executed every time your function is triggered
export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');
  const databases = new Databases(client);

  // ENV VARS: Set these in your Appwrite Function settings
  const DB_ID = process.env.DB_ID;
  const ITEMS_COLLECTION_ID = process.env.ITEMS_COLLECTION_ID;
  const PRICE_HISTORY_COLLECTION_ID = process.env.PRICE_HISTORY_COLLECTION_ID;
  const STATS_COLLECTION_ID = process.env.STATS_COLLECTION_ID;

  // Helper: fetch all documents from a collection (paginated)
  async function getAllDocuments(collectionId, query) {
    let docs = [];
    let cursor = undefined;
    do {
      const result = await databases.listDocuments(DB_ID, collectionId, [
        ...(query || []),
        ...(cursor ? [Databases.Query.cursorAfter(cursor)] : []),
        Databases.Query.limit(100),
      ]);
      docs = docs.concat(result.documents);
      cursor = result.documents.length ? result.documents[result.documents.length - 1].$id : undefined;
    } while (cursor);
    return docs;
  }

  try {
    // 1. Get all items
    const items = await getAllDocuments(ITEMS_COLLECTION_ID);
    let updated = 0;
    for (const item of items) {
      // 2. Get all price history for this item
      const priceDocs = await getAllDocuments(PRICE_HISTORY_COLLECTION_ID, [Databases.Query.equal('itemId', item.$id)]);
      const prices = priceDocs.map(doc => doc.price).filter(p => typeof p === 'number');
      if (prices.length === 0) continue;
      prices.sort((a, b) => a - b);
      const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
      const median = prices.length % 2 === 1
        ? prices[Math.floor(prices.length / 2)]
        : (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2;
      const p25 = prices[Math.floor(prices.length * 0.25)];
      const p75 = prices[Math.floor(prices.length * 0.75)];
      // 3. Upsert stats document (use itemId as docId for easy lookup)
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
      updated++;
    }
    return res.json({ status: 'ok', updated });
  } catch (err) {
    error('Error in median price stats function: ' + err.message);
    return res.json({ status: 'error', message: err.message });
  }
};
