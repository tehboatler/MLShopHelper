import { Client, Databases, Query } from 'node-appwrite';
const fetch = global.fetch || (await import('node-fetch')).default;

// Appwrite Function entrypoint for populating the items collection from a remote JSON URL
export default async ({ req, res, log, error }) => {
  log('[populate-items] Function invoked.');
  log(`[populate-items] Working directory: ${process.cwd()}`);
  log(`[populate-items] Environment variables: ${JSON.stringify(Object.keys(process.env))}`);
  log(`[populate-items] Entry: req.method=${req.method}, headers=${JSON.stringify(req.headers)}`);

  try {
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(req.headers['x-appwrite-key'] ?? '');
    log('[populate-items] Appwrite client initialized.');
    const databases = new Databases(client);

    // ENV VARS: Set these in your Appwrite Function settings
    const DB_ID = process.env.VITE_APPWRITE_DATABASE;
    const ITEMS_COLLECTION_ID = process.env.VITE_APPWRITE_ITEMS_COLLECTION;
    const DATA_SOURCE_URL = process.env.ITEMS_DATA_SOURCE_URL;

    log(`[populate-items] DB_ID=${DB_ID}, ITEMS_COLLECTION_ID=${ITEMS_COLLECTION_ID}, DATA_SOURCE_URL=${DATA_SOURCE_URL}`);

    if (!DB_ID || !ITEMS_COLLECTION_ID || !DATA_SOURCE_URL) {
      const missing = [
        !DB_ID && 'VITE_APPWRITE_DATABASE',
        !ITEMS_COLLECTION_ID && 'VITE_APPWRITE_ITEMS_COLLECTION',
        !DATA_SOURCE_URL && 'ITEMS_DATA_SOURCE_URL',
      ].filter(Boolean).join(', ');
      error(`[populate-items] Fatal error: Missing required environment variables: ${missing}`);
      throw new Error(`[populate-items] Fatal error: Missing required environment variables: ${missing}`);
    }

    // Fetch JSON from remote URL
    let items = [];
    try {
      log(`[populate-items] Fetching data from URL: ${DATA_SOURCE_URL}`);
      const response = await fetch(DATA_SOURCE_URL);
      log(`[populate-items] Fetch response: status=${response.status} statusText=${response.statusText}`);
      if (!response.ok) throw new Error(`HTTP ${response.status} - ${response.statusText}`);
      items = await response.json();
      log(`[populate-items] Fetched ${items.length} items from remote URL.`);
    } catch (e) {
      error(`[populate-items] Failed to fetch data from ${DATA_SOURCE_URL}: ${e.message}`);
      throw e;
    }

    // Deduplicate items: keep only the first (most recent) entry for each item name
    const dedupedMap = Object.create(null);
    const dedupedItems = [];
    for (const entry of items) {
      const name = entry.search_item;
      if (!name) continue;
      if (!dedupedMap[name]) {
        dedupedMap[name] = true;
        dedupedItems.push(entry);
      }
    }
    log(`[populate-items] Deduplicated items: reduced from ${items.length} to ${dedupedItems.length}`);

    // Bulk fetch all existing items in the collection (handle pagination)
    let allExisting = [];
    let page = 0;
    const pageSize = 100;
    let total = 0;
    do {
      log(`[populate-items] Fetching page ${page} of existing items...`);
      const resp = await databases.listDocuments(
        DB_ID,
        ITEMS_COLLECTION_ID,
        [Query.limit(pageSize), Query.offset(page * pageSize)]
      );
      log(`[populate-items] Page ${page}: fetched ${resp.documents.length} documents (total=${resp.total})`);
      allExisting = allExisting.concat(resp.documents);
      total = resp.total;
      page++;
    } while (allExisting.length < total);
    log(`[populate-items] Total existing items fetched: ${allExisting.length}`);
    // Build a map: name -> { $id, search_item_timestamp }
    const existingMap = {};
    for (const doc of allExisting) {
      if (doc.name) existingMap[doc.name] = { $id: doc.$id, search_item_timestamp: doc.search_item_timestamp };
    }
    log(`[populate-items] Existing map keys: ${Object.keys(existingMap).length}`);

    // Helper for concurrency-limited batch processing with optional delay between batches
    async function batchProcess(items, handler, limit = 3, delayMs = 500) {
      const results = [];
      let idx = 0;
      async function next() {
        if (idx >= items.length) return;
        const current = idx++;
        results[current] = await handler(items[current]);
        // Add delay after every batch
        if (delayMs && (current + 1) % limit === 0) {
          log(`[populate-items] Throttling: waiting ${delayMs}ms to avoid rate limits...`);
          await new Promise(r => setTimeout(r, delayMs));
        }
        return next();
      }
      await Promise.all(Array(Math.min(limit, items.length)).fill(0).map(next));
      return results;
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const upsertResults = await batchProcess(dedupedItems, async (entry) => {
      const name = entry.search_item;
      const price = entry.p50;
      if (!name || typeof price !== 'number') {
        log(`[populate-items] Skipping item due to missing name or price: ${JSON.stringify(entry)}`);
        skipped++;
        return { status: 'skipped', name };
      }
      const doc = {
        name,
        price, // Use p50 for price
        p0: entry.p0,
        p25: entry.p25,
        p50: entry.p50,
        p75: entry.p75,
        p100: entry.p100,
        mean: entry.mean,
        std: entry.std,
        search_results_captured: entry.search_results_captured,
        sum_bundle: entry.sum_bundle,
        num_outlier: entry.num_outlier,
        search_item_timestamp: entry.search_item_timestamp,
      };
      try {
        const existing = existingMap[name];
        if (existing) {
          const existingTimestamp = existing.search_item_timestamp;
          if (
            entry.search_item_timestamp &&
            existingTimestamp &&
            entry.search_item_timestamp === existingTimestamp
          ) {
            skipped++;
            log(`[populate-items] Skipped (no timestamp change): ${name}`);
            return { status: 'skipped', name };
          }
          await databases.updateDocument(DB_ID, ITEMS_COLLECTION_ID, existing.$id, doc);
          updated++;
          log(`[populate-items] Updated: ${name} (${price})`);
          return { status: 'updated', name };
        } else {
          await databases.createDocument(DB_ID, ITEMS_COLLECTION_ID, 'unique()', doc);
          created++;
          log(`[populate-items] Created: ${name} (${price})`);
          return { status: 'created', name };
        }
      } catch (err) {
        failed++;
        error(`[populate-items] Failed to upsert ${name}: ${err.message}`);
        return { status: 'failed', name, error: err.message };
      }
    }, 3, 500); // 3 concurrent, 500ms delay between batches

    // Summarize results
    const summary = upsertResults.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});
    log(`[populate-items] Upsert summary: ${JSON.stringify(summary)}`);

    res.json({ created, updated, skipped, failed });
  } catch (e) {
    error(`[populate-items] Uncaught error: ${e.stack || e}`);
    throw e;
  }
};
