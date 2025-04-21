import { useEffect, useState } from 'react';
import { getDb } from '../rxdb';

export function useRxdbPriceHistory(): [any[], boolean] {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let sub: any;
    getDb().then(db => {
      sub = db.priceHistory.find().$.subscribe(docs => {
        setHistory(docs.map(doc => doc.toJSON()));
        setLoading(false);
      });
    });
    return () => sub?.unsubscribe();
  }, []);
  return [history, loading];
}
