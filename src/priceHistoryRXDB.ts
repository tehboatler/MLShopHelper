import { getDb } from './rxdb';

export async function getRecentPriceHistory(itemId: string) {
  const db = await getDb();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffISO = cutoff.toISOString();
  return db.priceHistory.find({
    selector: {
      itemId,
      date: { $gte: cutoffISO }
    },
    sort: [{ date: 'desc' }]
  }).exec();
}

export async function addPriceHistoryEntryRX(entry: any) {
  // Add this log to see the raw entry as received by addPriceHistoryEntryRX
  console.log('addPriceHistoryEntryRX raw entry', entry);
  const db = await getDb();
  // Use $id as the primary key from Appwrite, but store as 'id' in RXDB
  const docId = entry.$id || entry.id;
  if (!docId) {
    throw new Error('Entry must have $id or id');
  }
  // Always store as 'id', not '$id'
  const rxdbEntry = { ...entry, id: docId };
  delete rxdbEntry.$id;
  // Check if document with this id already exists
  let existing = await db.priceHistory.findOne({ selector: { id: docId } }).exec();
  if (existing) {
    // Compare fields, update if different (shallow compare for now)
    const existingData = existing.toJSON();
    let needsUpdate = false;
    for (const k of Object.keys(rxdbEntry)) {
      if (rxdbEntry[k] !== existingData[k]) {
        needsUpdate = true;
        break;
      }
    }
    if (needsUpdate) {
      await existing.patch({ ...rxdbEntry });
    }
  } else {
    try {
      await db.priceHistory.insert(rxdbEntry);
    } catch (e: any) {
      // Safely check for conflict error (409) in a type-safe way
      const isConflict = !!(
        e &&
        typeof e === 'object' &&
        'parameters' in e &&
        e.parameters &&
        typeof e.parameters === 'object' &&
        e.parameters.writeError &&
        e.parameters.writeError.status === 409
      );
      if (isConflict) {
        existing = await db.priceHistory.findOne({ selector: { id: docId } }).exec();
        if (existing) {
          await existing.patch({ ...rxdbEntry });
        } else {
          throw e;
        }
      } else {
        throw e;
      }
    }
  }
  // Optionally prune old entries for this item
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffISO = cutoff.toISOString();
  const old = await db.priceHistory.find({
    selector: {
      itemId: rxdbEntry.itemId,
      date: { $lt: cutoffISO }
    }
  }).exec();
  for (const doc of old) {
    await doc.remove();
  }
}
