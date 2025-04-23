import { useState } from 'react';
import { redeemInvite } from '../api/invites';

export function useRedeemInvite() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redeem = async (inviteCode: string, userId: string) => {
    setLoading(true);
    setError(null);
    try {
      await redeemInvite(inviteCode, userId);
    } catch (e: any) {
      setError(e.message || 'Failed to redeem invite');
    }
    setLoading(false);
  };

  return { redeem, loading, error };
}
