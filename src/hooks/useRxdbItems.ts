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
    getDb().then(db => {
      sub = db.items.find().$.subscribe(docs => {
        console.debug('[useRxdbItems] RxDB emission:', docs.map(doc => doc.toJSON()));
        setItems(docs.map(doc => {
          const json = doc.toJSON();
          // Always provide $id for UI/types compatibility (copy to new object to avoid mutation error)
          return json.$id ? json : { ...json, $id: json.id };
        }));
        setLoading(false);
      });
    });
    return () => sub?.unsubscribe();
  }, [isAuthenticated]);
  return [items, loading];
}
