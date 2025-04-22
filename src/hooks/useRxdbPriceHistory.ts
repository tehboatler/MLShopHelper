import { useEffect, useState } from 'react';
import { getDb } from '../rxdb';

// LIFTED: accepts externally controlled state
export function useRxdbPriceHistory(
  externalHistory?: [any[], React.Dispatch<React.SetStateAction<any[]>>]
): [any[], boolean, React.Dispatch<React.SetStateAction<any[]>>] {
  const [internalHistory, setInternalHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const history = externalHistory ? externalHistory[0] : internalHistory;
  const setHistory = externalHistory ? externalHistory[1] : setInternalHistory;
  useEffect(() => {
    let sub: any;
    getDb().then(db => {
      sub = db.priceHistory.find().$.subscribe(docs => {
        setHistory(docs.map(doc => doc.toJSON()));
        setLoading(false);
        // Debug: log every emission to verify RxDB triggers after price change
        const allDocs = docs.map(doc => doc.toJSON());
        const itemIds = allDocs.map(d => d.itemId);
        const prices = allDocs.map(d => ({ itemId: d.itemId, price: d.price, author: d.author, date: d.date }));
        console.log('[useRxdbPriceHistory] Emitted docs:', prices);
      });
    });
    return () => sub?.unsubscribe();
  }, [setHistory]);
  return [history, loading, setHistory];
}
