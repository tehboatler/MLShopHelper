import { Client, Databases, Query } from 'node-appwrite';
const fetch = global.fetch || (await import('node-fetch')).default;
import fs from 'fs/promises';

// Appwrite Function entrypoint for populating the items collection from a remote JSON URL
export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');
  const databases = new Databases(client);

  // ENV VARS: Set these in your Appwrite Function settings
  const DB_ID = process.env.VITE_APPWRITE_DATABASE;
  const ITEMS_COLLECTION_ID = process.env.VITE_APPWRITE_ITEMS_COLLECTION;
  const DATA_SOURCE_URL = process.env.ITEMS_DATA_SOURCE_URL;

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
    const response = await fetch(DATA_SOURCE_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status} - ${response.statusText}`);
    items = await response.json();
    log(`[populate-items] Fetched ${items.length} items from remote URL.`);
  } catch (e) {
    error(`[populate-items] Failed to fetch data from ${DATA_SOURCE_URL}: ${e.message}`);
    throw e;
  }

  // Bulk fetch all existing items in the collection (handle pagination)
  let allExisting = [];
  let page = 0;
  const pageSize = 100;
  let total = 0;
  do {
    const resp = await databases.listDocuments(
      DB_ID,
      ITEMS_COLLECTION_ID,
      [Query.limit(pageSize), Query.offset(page * pageSize)]
    );
    allExisting = allExisting.concat(resp.documents);
    total = resp.total;
    page++;
  } while (allExisting.length < total);
  // Build a map: name -> { $id, search_item_timestamp }
  const existingMap = {};
  for (const doc of allExisting) {
    if (doc.name) existingMap[doc.name] = { $id: doc.$id, search_item_timestamp: doc.search_item_timestamp };
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  for (const entry of items) {
    const name = entry.search_item;
    if (!name || typeof entry.p50 !== 'number') continue;
    const doc = {
      name,
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
          continue;
        }
        await databases.updateDocument(DB_ID, ITEMS_COLLECTION_ID, existing.$id, doc);
        updated++;
        log(`[populate-items] Updated: ${name} (${entry.p50})`);
      } else {
        await databases.createDocument(DB_ID, ITEMS_COLLECTION_ID, 'unique()', doc);
        created++;
        log(`[populate-items] Created: ${name} (${entry.p50})`);
      }
    } catch (err) {
      failed++;
      error(`[populate-items] Failed to upsert ${name}: ${err.message}`);
    }
  }
  res.json({ created, updated, skipped, failed });
};
