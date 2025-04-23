import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { InvitesModal } from '../InvitesModal';
import { createInvite } from '../api/invites';
import { updateUserKarma } from '../api/persistentAnon';
import { useUserInvites } from '../hooks/useUserInvites';

export interface Invite {
  code: string;
  used: boolean;
  createdAt: string;
  status: string;
}

interface InvitesContextValue {
  openInvites: () => void;
  closeInvites: () => void;
  isOpen: boolean;
  invites: Invite[];
  loading: boolean;
  error: string | null;
  createNewInvite: () => Promise<void>;
  refreshInvites: () => Promise<void>;
}

const InvitesContext = createContext<InvitesContextValue | undefined>(undefined);

export const InvitesProvider: React.FC<{ children: React.ReactNode; userId: string; userKarma?: number | null }> = ({ children, userId, userKarma }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [userKarmaState, setUserKarmaState] = useState(userKarma ?? null);
  const { invites, loading } = useUserInvites(userId); // Use RxDB for real-time invites
  const [error, setError] = useState<string | null>(null);

  // Sync userKarmaState with the prop if it changes
  useEffect(() => {
    if (typeof userKarma === 'number' && userKarma !== userKarmaState) {
      setUserKarmaState(userKarma);
    }
  }, [userKarma]);

  const openInvites = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeInvites = useCallback(() => {
    setIsOpen(false);
  }, []);

  const createNewInvite = useCallback(async () => {
    setError(null);
    try {
      await createInvite(userId);
      // No need to manually update invites; RxDB will sync
      const newKarma = await updateUserKarma(userId, -10);
      setUserKarmaState(newKarma);
    } catch (e: any) {
      setError(e.message || 'Failed to create invite');
    }
  }, [userId]);

  return (
    <InvitesContext.Provider value={{ openInvites, closeInvites, isOpen, invites, loading, error, createNewInvite, refreshInvites: async () => {} }}>
      {children}
      <InvitesModal
        open={isOpen}
        onClose={closeInvites}
        onCreateInvite={createNewInvite}
        invites={invites}
        loading={loading}
        error={error}
        karma={userKarmaState}
      />
    </InvitesContext.Provider>
  );
};

export function useInvites() {
  const ctx = useContext(InvitesContext);
  if (!ctx) throw new Error('useInvites must be used within an InvitesProvider');
  return ctx;
}
