import React, { useState } from 'react';
import { addUserToWhitelistByUserId, getAnonLinkDocByUserId, removeUserFromWhitelistByUserId } from './api/anonLinks';

interface FriendsModalProps {
  userId: string;
  onClose: () => void;
}

interface FriendInfo {
  userId: string;
  user_ign?: string;
}

export const FriendsModal: React.FC<FriendsModalProps> = ({ userId, onClose }) => {
  const [friendId, setFriendId] = useState('');
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [friends, setFriends] = useState<FriendInfo[]>([]);

  // Helper to reload friends list
  const reloadFriends = async () => {
    const doc = await getAnonLinkDocByUserId(userId);
    if (!doc?.whitelist || doc.whitelist.length === 0) {
      setFriends([]);
      return;
    }
    const friendDocs = await Promise.all(
      doc.whitelist.map(fid => getAnonLinkDocByUserId(fid))
    );
    setFriends(friendDocs.map((fdoc, idx) => ({
      userId: doc!.whitelist![idx],
      user_ign: fdoc?.user_ign || undefined,
    })));
  };

  React.useEffect(() => {
    reloadFriends();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleAddFriend = async () => {
    setAdding(true);
    setError('');
    setSuccess('');
    try {
      // Check if userId exists
      const friendDoc = await getAnonLinkDocByUserId(friendId);
      if (!friendDoc) {
        setError('No such user exists.');
        setAdding(false);
        return;
      }
      await addUserToWhitelistByUserId(userId, friendId);
      setSuccess('Friend added!');
      setFriendId('');
      await reloadFriends();
    } catch (e: any) {
      setError(e.message || 'Failed to add friend');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveFriend = async (fid: string) => {
    setRemoving(fid);
    setError('');
    setSuccess('');
    try {
      await removeUserFromWhitelistByUserId(userId, fid);
      setSuccess('Friend removed.');
      await reloadFriends();
    } catch (e: any) {
      setError(e.message || 'Failed to remove friend');
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(30,34,44,0.80)',
        backdropFilter: 'blur(8px)',
        zIndex: 4000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 0.2s',
      }}
      onClick={onClose}
    >
      <div
        style={{
          minWidth: 320,
          maxWidth: 440,
          width: '90vw',
          background: 'rgba(36,40,54,0.98)',
          borderRadius: 20,
          boxShadow: '0 12px 48px 0 rgba(20,20,30,0.60)',
          border: '1.5px solid rgba(220,225,255,0.13)',
          padding: '36px 32px 28px 32px',
          position: 'relative',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          aria-label="Close"
          onClick={onClose}
          style={{
            position: 'absolute', top: 18, right: 18,
            background: 'none', border: 'none', color: '#aaa', fontSize: 22, cursor: 'pointer',
            transition: 'color 0.15s',
          }}
          onMouseOver={e => (e.currentTarget.style.color = '#fff')}
          onMouseOut={e => (e.currentTarget.style.color = '#aaa')}
        >
          ×
        </button>
        <h2 style={{ marginBottom: 8, fontWeight: 700, fontSize: 28, letterSpacing: '-1px', color: '#fff' }}>
          Friends List
        </h2>
        <div style={{ color: '#aab3c5', marginBottom: 24, fontSize: 15, textAlign: 'center' }}>
          When you follow other users, they will be added to your friends list. You can filter the app to show only data from trusted friends.
        </div>
        <div style={{ width: '100%', display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            type="text"
            placeholder="Friend's User ID"
            value={friendId}
            onChange={e => setFriendId(e.target.value)}
            style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #38405a', background: '#181b22', color: '#fff', fontSize: 16, outline: 'none' }}
            disabled={adding}
            onFocus={e => (e.currentTarget.style.border = '1.5px solid #2d8cff')}
            onBlur={e => (e.currentTarget.style.border = '1.5px solid #38405a')}
          />
          <button
            onClick={handleAddFriend}
            disabled={!friendId || adding}
            style={{
              background: 'linear-gradient(90deg, #2d8cff 0%, #5b7fff 100%)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 16,
              border: 'none',
              borderRadius: 12,
              padding: '10px 22px',
              cursor: adding ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 12px 0 rgba(45,140,255,0.08)',
              transition: 'background 0.15s',
            }}
          >
            {adding ? 'Adding...' : 'Add Friend'}
          </button>
        </div>
        {error && <div style={{ color: '#ff4d4f', marginBottom: 10, fontSize: 14 }}>{error}</div>}
        {success && <div style={{ color: '#5f5', marginBottom: 10, fontSize: 14 }}>{success}</div>}
        <div style={{ width: '100%', marginTop: 10 }}>
          <b style={{ color: '#b0b9d6', fontWeight: 600, fontSize: 15 }}>Trusted Friends:</b>
          <ul style={{ margin: '10px 0 0 0', padding: 0, listStyle: 'none', maxHeight: 200, overflowY: 'auto' }}>
            {friends.length === 0 && <li style={{ color: '#888', fontSize: 15 }}>No friends yet.</li>}
            {friends.map(f => (
              <li key={f.userId} style={{ color: '#fff', background: 'rgba(255,255,255,0.04)', borderRadius: 9, padding: '10px 12px', marginBottom: 9, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1.5px solid #2d8cff44', transition: 'box-shadow 0.18s' }}>
                <span>{f.user_ign ? `${f.user_ign} ` : ''}<span style={{ color: '#b0b9d6' }}>({f.userId})</span></span>
                <button
                  onClick={() => handleRemoveFriend(f.userId)}
                  disabled={removing === f.userId}
                  style={{ marginLeft: 10, background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 18px', fontWeight: 700, cursor: removing === f.userId ? 'not-allowed' : 'pointer', fontSize: 15, boxShadow: '0 1px 4px 0 #e74c3c22', transition: 'background 0.15s' }}
                  title="Remove Friend"
                >
                  {removing === f.userId ? '...' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 24, width: '100%' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              background: 'linear-gradient(90deg, #2d8cff 0%, #5b7fff 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              fontWeight: 600,
              fontSize: 17,
              padding: '12px 0',
              cursor: 'pointer',
              boxShadow: '0 2px 12px 0 rgba(45,140,255,0.08)',
              transition: 'background 0.15s',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
