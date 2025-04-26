import { useEffect, useState } from 'react';
import { getDb } from '../rxdb';
import type { RecentPriceHistoryEntry } from './useRecentPriceHistory';

export function useRecentPriceHistoryMap(
  itemIds: string[] = [],
  userId: string | undefined,
  count = 3
): Record<string, RecentPriceHistoryEntry[]> {
  const [entriesMap, setEntriesMap] = useState<Record<string, RecentPriceHistoryEntry[]>>({});

  useEffect(() => {
    if (!userId || !itemIds.length) {
      setEntriesMap({});
      return;
    }
    let cancelled = false;
    (async () => {
      const db = await getDb();
      // Query all price history entries for these items by this user
      const docs = await db.priceHistory.find({
        selector: {
          itemId: { $in: itemIds },
          author: userId,
          _deleted: { $ne: true },
        },
        sort: [{ date: 'desc' }],
      }).exec();

      // Group by itemId and take only the most recent N for each
      const grouped: Record<string, RecentPriceHistoryEntry[]> = {};
      for (const itemId of itemIds) {
        grouped[itemId] = [];
      }
      for (const doc of docs) {
        const arr = grouped[doc.itemId] || [];
        if (arr.length < count) {
          arr.push({
            id: doc.id,
            price: doc.price,
            date: doc.date,
            author: doc.author,
            sold: doc.sold,
          });
          grouped[doc.itemId] = arr;
        }
      }
      if (!cancelled) setEntriesMap(grouped);
    })();
    return () => {
      cancelled = true;
    };
  }, [itemIds.join(','), userId, count]);

  return entriesMap;
}
