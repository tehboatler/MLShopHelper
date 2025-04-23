// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React, { useState } from "react";
import { Dropdown } from "./Dropdown";
import {logout } from "./api/auth";
// import { getPersistentUserId } from './api/persistentAnon';
import { FriendsModal } from './FriendsModal';
// import { useInvites } from './providers/InvitesProvider';

interface ToolbarProps {
  onSetIGN: () => void;
  onAbout: () => void;
  ign: string;
  compactMode: boolean;
  setCompactMode: (val: boolean) => void;
  userKarma: number | null;
  filterByFriends: boolean;
  setFilterByFriends: React.Dispatch<React.SetStateAction<boolean>>;
  onShowInvites: () => void;
}

export function Toolbar({ onSetIGN, onAbout, ign, compactMode, setCompactMode, userKarma, filterByFriends, setFilterByFriends, onShowInvites }: ToolbarProps) {
  const [showUserModal, setShowUserModal] = useState(false);
  const [userId, _] = useState<string | null>(null);
  const [persistentSecret, setPersistentSecret] = useState<string | null>(null);
  const [persistentUserId, setPersistentUserId] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [error, setError] = useState("");
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [copied, setCopied] = useState(false);
  // const { openInvites } = useInvites();

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

  const handleCopySecret = () => {
    if (persistentSecret) {
      navigator.clipboard.writeText(persistentSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
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
            <button
              style={{
                marginLeft: 7,
                background: 'rgba(45,140,255,0.08)',
                color: '#2d8cff',
                border: 'none',
                borderRadius: 7,
                fontWeight: 500,
                fontSize: 15,
                padding: '4px 14px',
                cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s',
                boxShadow: 'none',
                outline: 'none',
                letterSpacing: 0.1,
                opacity: 0.93,
                position: 'relative',
                top: '-1px',
              }}
              onClick={onShowInvites}
              aria-label="Show Invites"
              title="Manage Invites"
            >
              Invites
            </button>
          </div>
        </div>
      </div>
      <div style={{ clear: 'both' }} />
      {/* User Info Modal */}
      {showUserModal && (
        <div className="modal-backdrop modal-fade-in" style={{ zIndex: 3000, backdropFilter: 'blur(2px)' }} onClick={() => setShowUserModal(false)}>
          <div
            className="modal-content modal-content-in"
            style={{
              minWidth: 340,
              maxWidth: 420,
              background: '#20222a',
              color: '#fff',
              borderRadius: 16,
              padding: '32px 28px 22px 28px',
              position: 'relative',
              margin: '60px auto',
              boxShadow: '0 8px 32px #000a',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              alignItems: 'stretch',
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setShowUserModal(false)}
              style={{
                position: 'absolute',
                top: 14,
                right: 18,
                background: 'none',
                border: 'none',
                color: '#aaa',
                fontSize: 26,
                cursor: 'pointer',
                padding: 0,
                lineHeight: 1,
                transition: 'color 0.15s',
              }}
              onMouseOver={e => (e.currentTarget.style.color = '#fff')}
              onMouseOut={e => (e.currentTarget.style.color = '#aaa')}
              aria-label="Close"
            >×</button>
            <h3 style={{ margin: 0, marginBottom: 8, fontWeight: 700, fontSize: 22, letterSpacing: 0.1 }}>Your Persistent Credentials</h3>
            {error ? (
              <div style={{ color: '#f55', fontWeight: 500, fontSize: 16, margin: '12px 0' }}>{error}</div>
            ) : (
              <>
                <div style={{
                  background: '#23263a',
                  borderRadius: 10,
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  marginBottom: 7,
                  border: '1.5px solid #262a3a',
                }}>
                  <span style={{ fontSize: 14, color: '#b0b9d6', fontWeight: 600, marginBottom: 2 }}>Persistent Secret</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      fontFamily: 'monospace',
                      fontSize: 15,
                      color: persistentSecret ? '#fff' : '#ffb700',
                      wordBreak: 'break-all',
                      background: persistentSecret ? 'rgba(255,255,255,0.04)' : 'none',
                      padding: persistentSecret ? '3px 7px' : 0,
                      borderRadius: 6,
                      userSelect: 'all',
                      minHeight: 22,
                      minWidth: 60,
                      flex: 1
                    }}>
                      {persistentSecret || 'Not available. Save it when you create your account!'}
                    </span>
                    {persistentSecret && (
                      <button
                        onClick={handleCopySecret}
                        title="Copy secret to clipboard"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: copied ? '#2d8cff' : '#b0b9d6',
                          fontSize: 18,
                          cursor: 'pointer',
                          padding: 0,
                          marginLeft: 2,
                          transition: 'color 0.15s',
                        }}
                      >
                        {copied ? '✓' : '📋'}
                      </button>
                    )}
                    {copied && (
                      <span style={{ color: '#2d8cff', fontWeight: 500, fontSize: 13, marginLeft: 2 }}>Copied!</span>
                    )}
                  </div>
                </div>
                <div style={{
                  background: '#23263a',
                  borderRadius: 10,
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  marginBottom: 7,
                  border: '1.5px solid #262a3a',
                }}>
                  <span style={{ fontSize: 14, color: '#b0b9d6', fontWeight: 600, marginBottom: 2 }}>Persistent User ID</span>
                  <span style={{
                    fontFamily: 'monospace',
                    fontSize: 15,
                    color: persistentUserId ? '#fff' : '#ffb700',
                    wordBreak: 'break-all',
                    background: persistentUserId ? 'rgba(255,255,255,0.04)' : 'none',
                    padding: persistentUserId ? '3px 7px' : 0,
                    borderRadius: 6,
                    userSelect: 'all',
                    minHeight: 22,
                    minWidth: 60,
                  }}>
                    {persistentUserId || 'Not available.'}
                  </span>
                </div>
                <div style={{
                  color: '#ffb700',
                  background: 'rgba(255,183,0,0.08)',
                  borderRadius: 8,
                  fontSize: 14,
                  padding: '10px 14px',
                  marginTop: 2,
                  fontWeight: 500,
                  textAlign: 'center',
                  border: '1px solid #ffb70044',
                }}>
                  <b>Warning:</b> Save these somewhere safe! If you lose them, you cannot recover your data.
                </div>
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
