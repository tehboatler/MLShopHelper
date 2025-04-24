// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React, { useState } from "react";
import { Dropdown } from "./Dropdown";
import { logout } from "./api/auth";
// import { getPersistentUserId } from './api/persistentAnon';
import { FriendsModal } from './FriendsModal';
import { UserCredentialModal } from './UserCredentialModal';
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

export function Toolbar({ onSetIGN, ign, userKarma, filterByFriends, setFilterByFriends, onShowInvites }: ToolbarProps) {
  const [showUserCredentialModal, setShowUserCredentialModal] = useState(false);
  const [userId, _] = useState<string | null>(null);
  const [persistentSecret, setPersistentSecret] = useState<string | null>(null);
  const [persistentUserId, setPersistentUserId] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [__, setError] = useState("");
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  // const [___, setCopied] = useState(false);
  // const { openInvites } = useInvites();

  const handleShowUserInfo = async () => {
    setLoadingUser(true);
    setError("");
    try {
      const secret = localStorage.getItem('persistentSecret');
      const userId = localStorage.getItem('persistentUserId');
      setPersistentSecret(secret);
      setPersistentUserId(userId);
      setShowUserCredentialModal(true);
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

  // const handleCopySecret = () => {
  //   if (persistentSecret) {
  //     navigator.clipboard.writeText(persistentSecret);
  //     setCopied(true);
  //     setTimeout(() => setCopied(false), 1200);
  //   }
  // };

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
            {/* Removed App Dropdown as requested */}
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
              title="Show only your own entries"
            >
              {filterByFriends ? 'Filtering by Self' : 'Filter by Self'}
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
      {/* User Credential Modal */}
      <UserCredentialModal
        open={showUserCredentialModal}
        onClose={() => setShowUserCredentialModal(false)}
        persistentSecret={persistentSecret}
        persistentUserId={persistentUserId}
      />
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
