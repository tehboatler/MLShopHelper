import { useState } from 'react';
import { createInvite } from '../api/invites';

export function useCreateInvite(userId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setLoading(true);
    setError(null);
    try {
      await createInvite(userId);
    } catch (e: any) {
      setError(e.message || 'Failed to create invite');
    }
    setLoading(false);
  };

  return { create, loading, error };
}
