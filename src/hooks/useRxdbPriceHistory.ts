import { useEffect, useState } from 'react';
import { getDb, getDbEpoch } from '../rxdb';

// LIFTED: accepts externally controlled state
export function useRxdbPriceHistory(
  isAuthenticated: boolean = true,
  externalHistory?: [any[], React.Dispatch<React.SetStateAction<any[]>>]
): [any[], boolean, React.Dispatch<React.SetStateAction<any[]>>] {
  const [internalHistory, setInternalHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const history = externalHistory ? externalHistory[0] : internalHistory;
  const setHistory = externalHistory ? externalHistory[1] : setInternalHistory;
  const epoch = getDbEpoch();
  useEffect(() => {
    if (!isAuthenticated) {
      setHistory([]);
      setLoading(false);
      return;
    }
    let sub: any;
    getDb().then(db => {
      sub = db.priceHistory.find().$.subscribe(async docs => {
        setHistory(docs.map(doc => doc.toJSON()));
        setLoading(false);
        // Debug: log every emission to verify RxDB triggers after price change
        const allDocs = docs.map(doc => doc.toJSON());
        const prices = allDocs.map(d => ({ itemId: d.itemId, price: d.price, author: d.author, date: d.date }));
        console.log('[useRxdbPriceHistory] Emitted docs:', prices);
        // --- ADDED: log and trigger stats update on first non-empty emission ---
        if ((window as any)._hasTriggeredStatsUpdate !== true && docs.length > 0) {
          (window as any)._hasTriggeredStatsUpdate = true;
          console.log('[useRxdbPriceHistory] First non-empty emission detected, triggering updateAllItemStats');
          try {
            const { updateAllItemStats } = await import('../rxdb');
            await updateAllItemStats();
            console.log('[useRxdbPriceHistory] updateAllItemStats() called');
          } catch (e) {
            console.error('[useRxdbPriceHistory] Failed to call updateAllItemStats:', e);
          }
        }
      });
    });
    return () => sub && sub.unsubscribe();
  }, [isAuthenticated, setHistory, epoch]);
  return [history, loading, setHistory];
}
