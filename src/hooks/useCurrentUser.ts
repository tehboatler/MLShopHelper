import { useState, useEffect } from 'react';
import { account } from '../lib/appwrite';

export interface CurrentUser {
  $id: string;
  name?: string;
  email?: string;
  labels?: string[];
  // add other user fields if needed
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    account
      .get()
      .then((u) => setUser(u as CurrentUser))
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, []);

  const hasLabel = (label: string): boolean => {
    return user?.labels?.includes(label) ?? false;
  };

  const hasAnyLabel = (labels: string[]): boolean => {
    return user?.labels?.some((l) => labels.includes(l)) ?? false;
  };

  return { user, loading, error, hasLabel, hasAnyLabel };
}
