// This script will import all price history entries from Appwrite into RXDB.
// Run this ONCE in dev mode. Do not include in production builds.

import { getDb } from './rxdb';
import { getPriceHistory } from './api/priceHistory';
import { addPriceHistoryEntryRX } from './priceHistoryRXDB';

/**
 * Import all price history entries for all items from Appwrite into RXDB.
 * Only run this in development, and only once per user.
 */
export async function migrateAppwritePriceHistoryToRXDB(itemIds: string[]) {
  const db = await getDb();
  let totalImported = 0;
  for (const itemId of itemIds) {
    try {
      const res = await getPriceHistory(itemId);
      const entries = res.documents || [];
      for (const doc of entries) {
        // RXDB primary key is 'id', Appwrite uses '$id'.
        const rxEntry = {
          id: doc.$id,
          itemId: doc.itemId,
          price: doc.price,
          date: doc.date,
          author: doc.author,
          notes: doc.notes,
          sold: doc.sold,
          downvotes: doc.downvotes || [],
        };
        // Insert into RXDB, skip if already exists
        const exists = await db.priceHistory.findOne({ selector: { id: rxEntry.id } }).exec();
        if (!exists) {
          await addPriceHistoryEntryRX(rxEntry);
          totalImported++;
        }
      }
      console.log(`[MIGRATE] Imported ${entries.length} entries for itemId=${itemId}`);
    } catch (err) {
      console.error(`[MIGRATE] Failed to import for itemId=${itemId}:`, err);
    }
  }
  console.log(`[MIGRATE] Finished. Total imported: ${totalImported}`);
}

// Usage example (DEV ONLY):
// import { getAllItemIds } from './api/items';
// getAllItemIds().then(ids => migrateAppwritePriceHistoryToRXDB(ids));
