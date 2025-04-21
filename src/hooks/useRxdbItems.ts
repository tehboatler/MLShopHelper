import { useEffect, useState } from 'react';
import { getDb } from '../rxdb';
import type { Item } from '../types';

export function useRxdbItems(isAuthenticated: boolean = true): Item[] {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    if (!isAuthenticated) {
      setItems([]);
      return;
    }
    let sub: any;
    getDb().then(db => {
      sub = db.items.find().$.subscribe(docs => {
        setItems(docs.map(doc => {
          const json = doc.toJSON();
          // Always provide $id for UI/types compatibility (copy to new object to avoid mutation error)
          return json.$id ? json : { ...json, $id: json.id };
        }));
      });
    });
    return () => sub?.unsubscribe();
  }, [isAuthenticated]);
  return items;
}
