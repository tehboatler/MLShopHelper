import { databases } from "../lib/appwrite";
import { Query } from "appwrite";
import type { PriceHistoryEntry } from "../types";
import { updateUserKarma } from "./persistentAnon";

const databaseId = import.meta.env.VITE_APPWRITE_DATABASE!;
const collectionId = import.meta.env.VITE_APPWRITE_PRICE_HISTORY_COLLECTION!;

/**
 * Add a new price history entry to the database.
 * @param data The price history entry data to add.
 * @returns The newly created document.
 */
export async function addPriceHistoryEntry(data: Omit<PriceHistoryEntry, "$id"> & { $id?: string; id?: string }) {
  // Remove undefined fields and $id/id from payload
  const cleanEntry: any = {};
  for (const key of Object.keys(data) as (keyof typeof data)[]) {
    if (
      data[key] !== undefined &&
      key !== '$id' &&
      key !== 'id'
    ) {
      cleanEntry[key] = data[key];
    }
  }
  // Use $id or id as the document ID ONLY as the 3rd argument
  const customId = (data as any).$id || (data as any).id || 'unique()';
  console.log('[addPriceHistoryEntry] Payload:', cleanEntry, 'CustomId:', customId);

  try {
    const res = await databases.createDocument(databaseId, collectionId, customId, cleanEntry);
    console.log('[addPriceHistoryEntry] Success:', res);
    // Increment karma for the author ONLY if sold is true
    if (data.author && data.sold) {
      try {
        await updateUserKarma(data.author, 1);
      } catch (e) {
        // Optionally log error, but don't block entry creation
        console.warn('Failed to increment karma for user', data.author, e);
      }
    }
    return res;
  } catch (err: any) {
    console.error('[addPriceHistoryEntry] Error:', err); // log the full error object
    throw err;
  }
}

// --- RXDB integration (minimal, now primary logic) ---
import { getDb } from '../rxdb';
import { addPriceHistoryEntryRX } from '../priceHistoryRXDB';

/**
 * Run a one-off sync to pull price history from Appwrite into RXDB.
 * Returns the replication state for further inspection if needed.
 */
export async function syncPriceHistoryToRxdb(itemId?: string) {
  // Only fetch entries for a specific item if itemId is provided
  const queries = itemId ? [Query.equal('itemId', itemId), Query.orderDesc('date'), Query.limit(30)] : [Query.orderDesc('date'), Query.limit(100)];
  const res = await databases.listDocuments(databaseId, collectionId, queries);
  for (const doc of res.documents) {
    await addPriceHistoryEntryRX({
      $id: doc.$id,
      itemId: doc.itemId,
      price: doc.price,
      date: doc.date,
      author: doc.author,
      author_ign: doc.author_ign || '',
      sold: !!doc.sold,
      downvotes: doc.downvotes || [],
      item_name: doc.item_name || undefined,
    });
  }
}

/**
 * Fetch recent price history for an item from RXDB (local cache).
 * This replaces the previous getPriceHistory logic.
 * @param itemId
 * @param authorIds (optional, not yet supported in RXDB version)
 * @returns Array of price history entries from RXDB
 */
export async function getPriceHistory(itemId: string, authorIds?: string[]) {
  const db = await getDb();
  // Example: fetch last 30 days, sorted desc
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffISO = cutoff.toISOString();
  const selector: any = {
    itemId,
    date: { $gte: cutoffISO }
  };
  // Optionally filter by authorIds if provided
  if (authorIds && authorIds.length > 0) {
    selector.author = { $in: authorIds };
  }
  const docs = await db.priceHistory.find({
    selector,
    sort: [{ date: 'desc' }]
  }).exec();
  // Map to plain objects (compatibility with previous usage)
  return docs.map(d => d._data || d);
}

// Fetch all price history entries for a given user (for all items)
export async function getPriceHistoryForUser(userId: string) {
  try {
    const res = await databases.listDocuments(databaseId, collectionId, [Query.equal('author', userId), Query.limit(1000)]);
    console.log(`[getPriceHistoryForUser] Returned ${res.documents.length} entries for userId=${userId}`);
    if (res.documents.length === 1000) {
      console.warn(`[getPriceHistoryForUser] Hit fetch limit for userId=${userId}. Results may be truncated.`);
    }
    return res;
  } catch (err) {
    console.error(`[getPriceHistoryForUser] Error fetching price history for userId=${userId}:`, err);
    throw err;
  }
}

export async function updatePriceHistoryEntry(id: string, data: Partial<PriceHistoryEntry>) {
  return databases.updateDocument(databaseId, collectionId, id, data);
}

// Downvote a price history entry by userId
export async function downvotePriceHistoryEntry(entryId: string, userId: string) {
  // Fetch the entry
  const entryRes = await databases.getDocument(databaseId, collectionId, entryId);
  const downvotes: string[] = entryRes.downvotes || [];
  if (downvotes.includes(userId)) {
    throw new Error('User has already downvoted this entry.');
  }
  // Add userId to downvotes
  downvotes.push(userId);
  await databases.updateDocument(databaseId, collectionId, entryId, { downvotes });
  // Decrement karma for the author ONLY if sold is true
  if (entryRes.author && entryRes.sold) {
    try {
      await updateUserKarma(entryRes.author, -1);
    } catch (e) {
      // Optionally log error, but don't block downvote
      console.warn('Failed to decrement karma for user', entryRes.author, e);
    }
  }
  return true;
}

/**
 * Fetch the latest price history entry for a given item and user.
 * @param itemId The ID of the item.
 * @param userId The user ID (author).
 * @returns The latest PriceHistoryEntry for this user and item, or undefined.
 */
export async function getLatestUserPriceEntry(itemId: string, userId: string) {
  const queries = [
    Query.equal("itemId", itemId),
    Query.equal("author", userId),
    Query.orderDesc("date"),
    Query.limit(1),
  ];
  try {
    const res = await databases.listDocuments(databaseId, collectionId, queries);
    if (res.documents.length > 0) {
      const doc = res.documents[0];
      return {
        $id: doc.$id,
        itemId: doc.itemId,
        price: doc.price,
        date: doc.date,
        author: doc.author,
        notes: doc.notes,
        sold: doc.sold,
        downvotes: doc.downvotes ?? [],
      };
    }
    return undefined;
  } catch (err) {
    console.error(`[getLatestUserPriceEntry] Error fetching for itemId=${itemId}, userId=${userId}:`, err);
    return undefined;
  }
}

/**
 * Fetch the latest sold price history entry for a given item (any user).
 * @param itemId The ID of the item.
 * @returns The latest sold PriceHistoryEntry for this item, or undefined.
 */
export async function getLatestSoldEntry(itemId: string) {
  const queries = [
    Query.equal("itemId", itemId),
    Query.equal("sold", true),
    Query.orderDesc("date"),
    Query.limit(1),
  ];
  try {
    const res = await databases.listDocuments(databaseId, collectionId, queries);
    if (res.documents.length > 0) {
      const doc = res.documents[0];
      return {
        $id: doc.$id,
        itemId: doc.itemId,
        price: doc.price,
        date: doc.date,
        author: doc.author,
        notes: doc.notes,
        sold: doc.sold,
        downvotes: doc.downvotes ?? [],
      };
    }
    return undefined;
  } catch (err) {
    console.error(`[getLatestSoldEntry] Error fetching for itemId=${itemId}:`, err);
    return undefined;
  }
}

/**
 * Fetch the latest price history entry for each item for a given user, in batch.
 * @param itemIds Array of item IDs to fetch for.
 * @param userId The user ID (author).
 * @returns Map of itemId to latest PriceHistoryEntry for that user.
 */
export async function getLatestUserPriceEntriesBatch(itemIds: string[], userId: string): Promise<Map<string, PriceHistoryEntry>> {
  if (!itemIds.length) return new Map();
  // Appwrite Query.equal only supports up to 100 values per field, so chunk if needed
  const chunkSize = 100;
  const chunks: string[][] = [];
  for (let i = 0; i < itemIds.length; i += chunkSize) {
    chunks.push(itemIds.slice(i, i + chunkSize));
  }
  let allEntries: PriceHistoryEntry[] = [];
  for (const chunk of chunks) {
    const queries = [
      Query.equal('author', userId),
      Query.equal('itemId', chunk),
      Query.orderDesc('date'),
      Query.limit(1000)
    ];
    try {
      const res = await databases.listDocuments(databaseId, collectionId, queries);
      allEntries = allEntries.concat(res.documents as any);
    } catch (err) {
      console.error(`[getLatestUserPriceEntriesBatch] Error fetching chunk:`, err);
    }
  }
  // Map itemId to latest entry (first seen in date-desc order)
  const latestMap = new Map<string, PriceHistoryEntry>();
  for (const entry of allEntries) {
    if (!latestMap.has(entry.itemId)) {
      latestMap.set(entry.itemId, entry);
    }
  }
  return latestMap;
}

/**
 * Batch fetch the latest sold price history entry for each item.
 * @param itemIds Array of item IDs to fetch for.
 * @returns Map of itemId to latest sold PriceHistoryEntry.
 */
export async function getLatestSoldEntriesBatch(itemIds: string[]): Promise<Map<string, PriceHistoryEntry>> {
  if (!itemIds.length) return new Map();
  const chunkSize = 100;
  const chunks: string[][] = [];
  for (let i = 0; i < itemIds.length; i += chunkSize) {
    chunks.push(itemIds.slice(i, i + chunkSize));
  }
  let allEntries: any[] = [];
  for (const chunk of chunks) {
    const queries = [
      Query.equal('itemId', chunk),
      Query.equal('sold', true),
      Query.orderDesc('date'),
      Query.limit(1000)
    ];
    try {
      const res = await databases.listDocuments(databaseId, collectionId, queries);
      allEntries = allEntries.concat(res.documents as any);
    } catch (err) {
      console.error(`[getLatestSoldEntriesBatch] Error fetching chunk:`, err);
    }
  }
  // Map itemId to latest sold entry (first seen in date-desc order)
  const latestMap = new Map<string, PriceHistoryEntry>();
  for (const entry of allEntries) {
    if (!latestMap.has(entry.itemId)) {
      latestMap.set(entry.itemId, entry);
    }
  }
  return latestMap;
}

/**
 * Fetch recent price history for an item from RXDB (local cache).
 * @param itemId
 */
export async function getRecentPriceHistoryFromRxdb(itemId: string) {
  const db = await getDb();
  // Example: fetch last 30 days, sorted desc
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffISO = cutoff.toISOString();
  const docs = await db.priceHistory.find({
    selector: {
      itemId,
      date: { $gte: cutoffISO }
    },
    sort: [{ date: 'desc' }]
  }).exec();
  return docs.map(d => d._data || d);
}
