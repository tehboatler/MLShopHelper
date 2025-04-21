// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React, { useState } from "react";
import { Dropdown } from "./Dropdown";
import {logout } from "./api/auth";
// import { getPersistentUserId } from './api/persistentAnon';
import { FriendsModal } from './FriendsModal';

interface ToolbarProps {
  onSetIGN: () => void;
  onAbout: () => void;
  ign: string;
  compactMode: boolean;
  setCompactMode: (val: boolean) => void;
  userKarma: number | null;
  filterByFriends: boolean;
  setFilterByFriends: React.Dispatch<React.SetStateAction<boolean>>;
}

export function Toolbar({ onSetIGN, onAbout, ign, compactMode, setCompactMode, userKarma, filterByFriends, setFilterByFriends }: ToolbarProps) {
  const [showUserModal, setShowUserModal] = useState(false);
  const [userId, _] = useState<string | null>(null);
  const [persistentSecret, setPersistentSecret] = useState<string | null>(null);
  const [persistentUserId, setPersistentUserId] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [error, setError] = useState("");
  const [showFriendsModal, setShowFriendsModal] = useState(false);

  const handleShowUserInfo = async () => {
    setLoadingUser(true);
    setError("");
    try {
      const secret = localStorage.getItem('persistentSecret');
      const userId = localStorage.getItem('persistentUserId');
      setPersistentSecret(secret);
      setPersistentUserId(userId);
      setShowUserModal(true);
    } catch (e: any) {
      setError(e.message || "Failed to fetch user info.");
    } finally {
      setLoadingUser(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    window.location.reload();
  };

  return (
    <header className="toolbar" style={{ width: '100%', background: '#232323', padding: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'stretch', width: '100%' }}>
        {/* Left side: Dropdowns and filter button */}
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', minHeight: 56 }}>
          <div className="toolbar-actions" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <Dropdown label="User">
              <div className="dropdown-item" onClick={onSetIGN}>Set IGN</div>
              <div className="dropdown-item" style={{ cursor: "default", color: "#888" }}>IGN: <b>{ign || "Not set"}</b></div>
              <div className="dropdown-item" onClick={handleShowUserInfo} style={{ color: '#2d8cff' }}>
                {loadingUser ? 'Loading...' : 'Show User ID / Session ID'}
              </div>
              <div className="dropdown-item" onClick={() => setShowFriendsModal(true)} style={{ color: '#2d8cff' }}>
                Friends
              </div>
              <div className="dropdown-item" onClick={handleLogout} style={{ color: '#e74c3c', fontWeight: 600 }}>
                Logout
              </div>
            </Dropdown>
            <Dropdown label="App">
              <div className="dropdown-item" onClick={onAbout}>About</div>
              <div className="dropdown-item" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={compactMode}
                  onChange={e => setCompactMode(e.target.checked)}
                  id="compact-mode-toggle"
                  style={{ marginRight: 8 }}
                />
                <label htmlFor="compact-mode-toggle" style={{ cursor: 'pointer', userSelect: 'none' }}>Compact Mode</label>
              </div>
            </Dropdown>
            <button
              onClick={() => setFilterByFriends(f => !f)}
              style={{
                marginLeft: 18,
                background: filterByFriends ? '#2d8cff' : '#181b22',
                color: filterByFriends ? '#fff' : '#b0b9d6',
                border: '1.5px solid #2d8cff',
                borderRadius: 7,
                fontWeight: 600,
                padding: '7px 18px',
                fontSize: 15,
                cursor: 'pointer',
                transition: 'background 0.18s, color 0.18s',
                boxShadow: filterByFriends ? '0 2px 8px #2d8cff22' : 'none',
                outline: filterByFriends ? '2px solid #2d8cff' : 'none',
              }}
              title="Show only entries from trusted friends"
            >
              {filterByFriends ? 'Filtering by Friends' : 'Filter by Friends'}
            </button>
          </div>
        </div>
        {/* Right side: Karma display */}
        <div className="karma-toolbar-display" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', minWidth: 120, gap: 6, paddingRight: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <img src="/placeholder-sell.png" alt="Karma" style={{ width: 22, height: 22, objectFit: 'contain', filter: 'grayscale(0.2)' }} />
            <span style={{ color: '#ffb700', fontWeight: 600, fontSize: 16, whiteSpace: 'nowrap', textAlign: 'right', width: '100%' }}>{userKarma !== null ? userKarma : '--'}</span>
          </div>
        </div>
      </div>
      <div style={{ clear: 'both' }} />
      {/* User Info Modal */}
      {showUserModal && (
        <div className="modal-backdrop modal-fade-in" style={{ zIndex: 3000 }} onClick={() => setShowUserModal(false)}>
          <div className="modal-content modal-content-in" style={{ minWidth: 340, maxWidth: 440, background: '#232323', color: '#fff', borderRadius: 14, padding: 28, position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowUserModal(false)} style={{ position: 'absolute', top: 10, right: 18, background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer' }}>×</button>
            <h3 style={{ marginTop: 0, marginBottom: 14 }}>Your Persistent Anonymous Credentials</h3>
            {error ? (
              <div style={{ color: '#f55' }}>{error}</div>
            ) : (
              <>
                <div style={{ marginBottom: 12 }}><b>Persistent Secret:</b> <code>{persistentSecret || <span style={{color:'#ffb700'}}>Not available. Save it when you create your account!</span>}</code></div>
                <div style={{ marginBottom: 12 }}><b>Persistent User ID:</b> <code>{persistentUserId || <span style={{color:'#ffb700'}}>Not available.</span>}</code></div>
                <div style={{ color: '#ffb700', fontSize: 14 }}><b>Warning:</b> Save these somewhere safe! If you lose them, you cannot recover your data.</div>
              </>
            )}
          </div>
        </div>
      )}
      {/* Friends Modal */}
      {showFriendsModal && (
        <FriendsModal
          userId={persistentUserId || userId || ''}
          onClose={() => setShowFriendsModal(false)}
        />
      )}
    </header>
  );
}
