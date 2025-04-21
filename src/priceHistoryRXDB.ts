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
  const db = await getDb();
  // Check if document with this id already exists
  const existing = await db.priceHistory.findOne({ selector: { id: entry.id } }).exec();
  if (existing) {
    // Compare fields, update if different (shallow compare for now)
    const existingData = existing.toJSON();
    let needsUpdate = false;
    for (const k of Object.keys(entry)) {
      if (entry[k] !== existingData[k]) {
        needsUpdate = true;
        break;
      }
    }
    if (needsUpdate) {
      await existing.atomicPatch({ ...entry });
    }
  } else {
    await db.priceHistory.insert(entry);
  }
  // Optionally prune old entries for this item
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffISO = cutoff.toISOString();
  const old = await db.priceHistory.find({
    selector: {
      itemId: entry.itemId,
      date: { $lt: cutoffISO }
    }
  }).exec();
  for (const doc of old) {
    await doc.remove();
  }
}
