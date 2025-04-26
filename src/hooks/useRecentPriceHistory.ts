import { useEffect, useState } from 'react';
import { getDb } from '../rxdb';

export interface RecentPriceHistoryEntry {
  id: string;
  price: number;
  date: string;
  author: string;
  sold?: boolean;
}

/**
 * React hook to fetch the last N price history entries for an item by a user from RxDB.
 * @param itemId - The item id to fetch history for
 * @param userId - The user id to filter by
 * @param count - Number of entries to fetch (default 3)
 */
export function useRecentPriceHistory(itemId: string | undefined, userId: string | undefined, count = 3) {
  const [entries, setEntries] = useState<RecentPriceHistoryEntry[]>([]);

  useEffect(() => {
    if (!itemId || !userId) {
      setEntries([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const db = await getDb();
      // Query last N price history entries for this item by this user, sorted desc
      const docs = await db.priceHistory.find({
        selector: {
          itemId,
          author: userId,
          _deleted: { $ne: true },
        },
        sort: [{ date: 'desc' }],
        limit: count,
      }).exec();
      if (!cancelled) {
        setEntries(docs.map((d: any) => ({
          id: d.id,
          price: d.price,
          date: d.date,
          author: d.author,
          sold: d.sold,
        })));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [itemId, userId, count]);

  return entries;
}
