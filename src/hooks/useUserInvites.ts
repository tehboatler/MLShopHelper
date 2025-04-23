import { useState, useEffect } from 'react';
import { getDb, getDbEpoch } from '../rxdb';

export function useUserInvites(userId: string) {
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const epoch = getDbEpoch();
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    let sub: any;
    getDb().then(db => {
      sub = db.invites.find({ selector: { createdBy: userId } }).$.subscribe((docs: any[]) => {
        setInvites(docs.map(doc => (typeof doc.toJSON === 'function' ? doc.toJSON() : doc)));
        setLoading(false);
      });
    });
    return () => sub && sub.unsubscribe();
  }, [userId, epoch]);
  return { invites, loading };
}
