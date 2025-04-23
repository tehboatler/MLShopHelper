import { useState, useEffect } from 'react';
import { getPersistentAnonUserById } from '../api/persistentAnon';

export function useUserKarma(userId: string) {
  const [karma, setKarma] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    let cancelled = false;
    async function fetchKarma() {
      const user = await getPersistentAnonUserById(userId);
      if (!cancelled) {
        setKarma(user.karma ?? 0);
        setLoading(false);
      }
    }
    fetchKarma();
    const interval = setInterval(fetchKarma, 2000); // Poll every 2s for updates
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userId]);
  return { karma, loading };
}
