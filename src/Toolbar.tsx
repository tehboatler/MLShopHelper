// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React, { useState } from "react";
import { Dropdown } from "./Dropdown";
import { getCurrentUser, createAnonymousSessionWithSessionId, logout } from "./api/auth";
import { getPersistentUserId } from './api/persistentAnon';

interface ToolbarProps {
  onSetIGN: () => void;
  onAbout: () => void;
  ign: string;
  compactMode: boolean;
  setCompactMode: (val: boolean) => void;
  userKarma: number | null;
}

export function Toolbar({ onSetIGN, onAbout, ign, compactMode, setCompactMode, userKarma }: ToolbarProps) {
  const [showUserModal, setShowUserModal] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [persistentSecret, setPersistentSecret] = useState<string | null>(null);
  const [persistentUserId, setPersistentUserId] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [error, setError] = useState("");

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
    <header className="toolbar">
      <div className="toolbar-actions" style={{ width: 'auto', float: 'left', display: 'flex', flexDirection: 'row', alignItems: 'space-between' }}>
        <Dropdown label="User">
          <div className="dropdown-item" onClick={onSetIGN}>Set IGN</div>
          <div className="dropdown-item" style={{ cursor: "default", color: "#888" }}>IGN: <b>{ign || "Not set"}</b></div>
          <div className="dropdown-item" onClick={handleShowUserInfo} style={{ color: '#2d8cff' }}>
            {loadingUser ? 'Loading...' : 'Show User ID / Session ID'}
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
      </div>
      <div className="karma-toolbar-display" style={{ float: 'right', display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 16 }}>
        <img src="/placeholder-sell.png" alt="Karma" style={{ width: 22, height: 22, objectFit: 'contain', filter: 'grayscale(0.2)' }} />
        <span style={{ color: '#ffb700', fontWeight: 600, fontSize: 16, whiteSpace: 'nowrap' }}>{userKarma !== null ? userKarma : '--'}</span>
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
    </header>
  );
}
