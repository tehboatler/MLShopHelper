import { useEffect, useState } from 'react';
import { getDb, getDbEpoch } from '../rxdb';

// Custom hook for itemStats with loading state (returns plain objects)
export function useRxdbItemStats(): [any[], boolean] {
  const [itemStats, setItemStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const epoch = getDbEpoch();
  useEffect(() => {
    let sub: any;
    getDb().then(db => {
      sub = db.itemStats.find().$.subscribe(statsDocs => {
        const stats = statsDocs.map(doc => (typeof doc.toJSON === 'function' ? doc.toJSON() : doc));
        setItemStats(stats);
        setLoading(false);
        // Debug: log each stat and its itemId
        console.log('[useRxdbItemStats] Emitted stats:', stats);
        if (stats.length > 0) {
          console.log('[useRxdbItemStats] Emitted itemIds:', stats.map(s => s.itemId));
          // Check for any missing/undefined itemId
          const missing = stats.filter(s => !s.itemId);
          if (missing.length > 0) {
            console.warn('[useRxdbItemStats] Stats with missing itemId:', missing);
          }
        }
      });
    });
    return () => sub && sub.unsubscribe();
  }, [epoch]);
  return [itemStats, loading];
}
