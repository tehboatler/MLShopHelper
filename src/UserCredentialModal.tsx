import React, { useState } from 'react';

interface UserCredentialModalProps {
  open: boolean;
  onClose: () => void;
  persistentSecret: string | null;
  persistentUserId: string | null;
}

export const UserCredentialModal: React.FC<UserCredentialModalProps> = ({ open, onClose, persistentSecret, persistentUserId }) => {
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedUserId, setCopiedUserId] = useState(false);

  if (!open) return null;

  const handleCopySecret = () => {
    if (persistentSecret) {
      navigator.clipboard.writeText(persistentSecret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 1200);
    }
  };
  const handleCopyUserId = () => {
    if (persistentUserId) {
      navigator.clipboard.writeText(persistentUserId);
      setCopiedUserId(true);
      setTimeout(() => setCopiedUserId(false), 1200);
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
          maxWidth: 400,
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
          User Credentials
        </h2>
        <div style={{ color: '#aab3c5', marginBottom: 24, fontSize: 15, textAlign: 'center' }}>
          These credentials are required to access your account. Save them somewhere safe!
        </div>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ color: '#b0b9d6', fontWeight: 600, marginBottom: 2 }}>Persistent Secret</label>
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
                    color: copiedSecret ? '#2d8cff' : '#b0b9d6',
                    fontSize: 18,
                    cursor: 'pointer',
                    padding: 0,
                    marginLeft: 2,
                    transition: 'color 0.15s',
                  }}
                >
                  {copiedSecret ? '✓' : '📋'}
                </button>
              )}
              {copiedSecret && (
                <span style={{ color: '#2d8cff', fontWeight: 500, fontSize: 13, marginLeft: 2 }}>Copied!</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ color: '#b0b9d6', fontWeight: 600, marginBottom: 2 }}>Persistent User ID</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                flex: 1
              }}>
                {persistentUserId || 'Not available.'}
              </span>
              {persistentUserId && (
                <button
                  onClick={handleCopyUserId}
                  title="Copy user ID to clipboard"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: copiedUserId ? '#2d8cff' : '#b0b9d6',
                    fontSize: 18,
                    cursor: 'pointer',
                    padding: 0,
                    marginLeft: 2,
                    transition: 'color 0.15s',
                  }}
                >
                  {copiedUserId ? '✓' : '📋'}
                </button>
              )}
              {copiedUserId && (
                <span style={{ color: '#2d8cff', fontWeight: 500, fontSize: 13, marginLeft: 2 }}>Copied!</span>
              )}
            </div>
          </div>
        </div>
        <div style={{
          color: '#ffb700',
          background: 'rgba(255,183,0,0.08)',
          borderRadius: 8,
          fontSize: 14,
          padding: '10px 14px',
          marginTop: 22,
          fontWeight: 500,
          textAlign: 'center',
          border: '1px solid #ffb70044',
        }}>
          <b>Warning:</b> If you lose these, you cannot recover your data.
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
