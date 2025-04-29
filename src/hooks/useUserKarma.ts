import { useState, useCallback } from 'react';
import { getPersistentAnonUserById } from '../api/persistentAnon';

export function useUserKarma(userId: string) {
  const [karma, setKarma] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const user = await getPersistentAnonUserById(userId);
    setKarma(user?.karma ?? 0);
    setLoading(false);
  }, [userId]);

  return { karma, loading, refresh };
}
