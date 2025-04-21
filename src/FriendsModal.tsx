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
    <div className="modal-backdrop modal-fade-in" style={{ zIndex: 3000 }} onClick={onClose}>
      <div className="modal-content modal-content-in" style={{ minWidth: 340, maxWidth: 440, background: '#232323', color: '#fff', borderRadius: 14, padding: 28, position: 'relative' }} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} style={{ position: 'absolute', top: 10, right: 18, background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer' }}>×</button>
        <h3 style={{ marginTop: 0, marginBottom: 14 }}>Friends List</h3>
        <div style={{ marginBottom: 16, color: '#b0b9d6', fontSize: 15 }}>
          When you follow other users in the app, they will be added to your friends list. You will be able to filter all data in the app to display only those price entries created by trusted friends.
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input
            type="text"
            placeholder="Friend's User ID"
            value={friendId}
            onChange={e => setFriendId(e.target.value)}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #444', background: '#181b22', color: '#fff' }}
            disabled={adding}
          />
          <button
            onClick={handleAddFriend}
            disabled={!friendId || adding}
            style={{ background: '#2d8cff', color: '#fff', padding: '8px 18px', borderRadius: 6, border: 'none', fontWeight: 600, cursor: adding ? 'not-allowed' : 'pointer' }}
          >
            Add Friend
          </button>
        </div>
        {error && <div style={{ color: '#f55', marginBottom: 10 }}>{error}</div>}
        {success && <div style={{ color: '#5f5', marginBottom: 10 }}>{success}</div>}
        <div style={{ marginTop: 18 }}>
          <b>Trusted Friends:</b>
          <ul style={{ margin: '10px 0 0 0', padding: 0, listStyle: 'none' }}>
            {friends.length === 0 && <li style={{ color: '#888' }}>No friends yet.</li>}
            {friends.map(f => (
              <li key={f.userId} style={{ color: '#fff', background: '#181b22', borderRadius: 6, padding: '6px 12px', marginBottom: 6, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{f.user_ign ? `${f.user_ign} ` : ''}<span style={{ color: '#b0b9d6' }}>({f.userId})</span></span>
                <button
                  onClick={() => handleRemoveFriend(f.userId)}
                  disabled={removing === f.userId}
                  style={{ marginLeft: 10, background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 5, padding: '3px 12px', fontWeight: 600, cursor: removing === f.userId ? 'not-allowed' : 'pointer', fontSize: 14 }}
                  title="Remove Friend"
                >
                  {removing === f.userId ? '...' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
