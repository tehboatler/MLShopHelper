import React, { useState, useEffect } from "react";
import { LedgerToggle, LedgerMode } from "./LedgerToggle";
import { LedgerList } from "./LedgerList";
import type { PriceHistoryEntry, Item } from "./types";
import { getPersistentAnonUsersInfoBatch } from "./api/persistentAnon";
import { liveQuery } from 'dexie';

export const Ledger: React.FC = () => {
  const [mode, setMode] = useState<LedgerMode>("personal");
  const [entries, setEntries] = useState<PriceHistoryEntry[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [itemMap, setItemMap] = useState<Record<string, Item>>({});
  const [authorIGNMap, setAuthorIGNMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    // Always use persistentUserId from localStorage
    const persistentUserId = localStorage.getItem('persistentUserId') || null;
    setUserId(persistentUserId);
    let sub: any = null;
    let ignore = false;
    (async () => {
      setLoading(true);
      const db = await import('./rxdb').then(m => m.getDb());
      // Fetch all items for mapping itemId -> name
      const items = await db.items.find().exec();
      const itemMapObj: Record<string, Item> = {};
      for (const item of items) {
        itemMapObj[item.$id] = item;
        if (item.id) itemMapObj[item.id] = item;
      }
      setItemMap(itemMapObj);
      // --- Live query for price history ---
      const query = db.priceHistory.find({
        selector: {},
        sort: [{ date: 'desc' }],
        limit: 500 // limit for safety
      });
      sub = query.$.subscribe(async (docs: any[]) => {
        if (ignore) return;
        // Optionally, batch fetch IGNs for authors
        const authorIds = Array.from(new Set(docs.map((d: any) => (d._data || d).author)));
        let ignMap: Record<string, { ign?: string }> = {};
        try {
          ignMap = await getPersistentAnonUsersInfoBatch(authorIds);
        } catch (err) {
          ignMap = {};
        }
        setAuthorIGNMap(Object.fromEntries(authorIds.map(id => [id, ignMap[id]?.ign || ''])));
        setEntries(docs.map((d: any) => {
          const data = d._data || d;
          return {
            $id: data.id || data.$id,
            itemId: data.itemId,
            price: data.price,
            date: data.date,
            author: data.author,
            author_ign: ignMap[data.author]?.ign || data.author_ign || data.author,
            notes: data.notes,
            sold: data.sold,
            downvotes: data.downvotes || [],
            item_name: data.item_name || itemMapObj[data.itemId]?.name || undefined,
          };
        }));
        setIsInitialLoad(false);
        setLoading(false);
      });
    })();
    return () => { cancelled = true; ignore = true; if (sub) sub.unsubscribe(); };
  }, []);

  // Filtered entries: ensure personal tab only shows current persistent user
  const filtered = mode === "personal" && userId ? entries.filter(e => e.author === userId) : entries;

  return (
    <div style={{
      padding: 12,
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: 0,
      height: '100%'
    }}>
      <LedgerToggle mode={mode} setMode={setMode} />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {isInitialLoad ? (
          <div style={{ color: '#aaa', fontSize: 16, padding: 18, textAlign: 'center' }}>Loading...</div>
        ) : (
          <LedgerList
            entries={filtered}
            itemMap={itemMap}
            emptyText={mode === 'personal' ? 'No personal ledger entries found.' : 'No global ledger entries found.'}
          />
        )}
      </div>
    </div>
  );
};

export default Ledger;
