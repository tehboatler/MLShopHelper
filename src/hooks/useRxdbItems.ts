import { useEffect, useState } from 'react';
import { getDb } from '../rxdb';
import type { Item } from '../types';

// Returns [items, loading]
export function useRxdbItems(isAuthenticated: boolean = true): [Item[], boolean] {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!isAuthenticated) {
      setItems([]);
      setLoading(false);
      return;
    }
    let sub: any;
    setLoading(true); 
    console.log('[useRxdbItems] setLoading(true) on effect run');
    let loadingStopped = false;
    getDb().then(db => {
      sub = db.items.find().$.subscribe(docs => {
        const items = docs.map(doc => {
          const json = doc.toJSON();
          return json.$id ? json : { ...json, $id: json.id };
        });
        setItems(items);
        // Only stop loading when we have items, or after timeout
        if (!loadingStopped && items.length > 0) {
          setLoading(false);
          loadingStopped = true;
          console.log('[useRxdbItems] setLoading(false) after RxDB emits items');
        }
      });
    });
    // Fallback: after 5 seconds, stop loading even if no items
    const timeout = setTimeout(() => {
      if (!loadingStopped) {
        setLoading(false);
        loadingStopped = true;
        console.log('[useRxdbItems] setLoading(false) after timeout');
      }
    }, 5000);
    return () => {
      sub && sub.unsubscribe();
      clearTimeout(timeout);
    };
  }, [isAuthenticated]);
  return [items, loading];
}
