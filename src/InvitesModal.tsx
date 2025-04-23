import React, { useState } from 'react';

interface InvitesModalProps {
  open: boolean;
  onClose: () => void;
  onCreateInvite: () => Promise<void>;
  invites?: { code: string; used: boolean; createdAt: string; status: string }[];
  loading?: boolean;
  error?: string | null;
  karma: number | null;
}

export const InvitesModal: React.FC<InvitesModalProps> = ({
  open,
  onClose,
  onCreateInvite,
  invites = [],
  loading = false,
  error = null,
  karma,
}) => {
  const [createError, setCreateError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const canAffordInvite = typeof karma === 'number' && karma >= 10;

  if (!open) return null;

  async function handleCreateInvite() {
    if (!canAffordInvite) {
      setCreateError('Not enough karma to create an invite. (Requires 10 karma)');
      return;
    }
    setCreateError(null);
    try {
      await onCreateInvite();
    } catch (e: any) {
      setCreateError(e.message || 'Failed to create invite');
    }
  }

  function handleClose() {
    setCreateError(null);
    onClose();
  }

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
      onClick={handleClose}
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
          onClick={handleClose}
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
          Invites
        </h2>
        {invites.filter(invite => invite.status !== 'redeemed').length > 0 && (
          <div style={{ color: '#7be2a1', fontWeight: 600, fontSize: 16, marginBottom: 10, textAlign: 'center' }}>
            You have {invites.filter(invite => invite.status !== 'redeemed').length} invite{invites.filter(invite => invite.status !== 'redeemed').length === 1 ? '' : 's'} ready to redeem.
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ color: '#ffb700', fontWeight: 600, fontSize: 18, display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style={{marginRight:2,marginBottom:-2}} xmlns="http://www.w3.org/2000/svg">
              <circle cx="10" cy="10" r="9" fill="#ffb700" stroke="#fff" strokeWidth="1.5"/>
              <text x="10" y="15" textAnchor="middle" fontSize="12" fill="#222" fontWeight="bold">K</text>
            </svg>
            {karma !== null ? karma : '--'} Karma
          </span>
        </div>
        <div style={{ color: '#aab3c5', marginBottom: 18, fontSize: 15, textAlign: 'center', lineHeight: 1.5 }}>
          Generating an invite will cost <span style={{color:'#ffb700',fontWeight:600}}>10 karma</span> from your account. Use invites to bring new users into the platform.
        </div>
        <button
          onClick={handleCreateInvite}
          disabled={loading || !canAffordInvite}
          style={{
            width: '100%',
            background: canAffordInvite ? 'linear-gradient(90deg, #2d8cff 0%, #5b7fff 100%)' : 'rgba(120,130,160,0.16)',
            color: canAffordInvite ? '#fff' : '#c1c7d6',
            border: 'none',
            borderRadius: 12,
            fontWeight: 600,
            fontSize: 17,
            padding: '12px 0',
            cursor: loading || !canAffordInvite ? 'not-allowed' : 'pointer',
            boxShadow: canAffordInvite ? '0 2px 12px 0 rgba(45,140,255,0.08)' : 'none',
            transition: 'background 0.15s',
            marginBottom: 18,
          }}
        >
          {loading ? 'Creating...' : 'Create Invite'}
        </button>
        {(createError || error) && (
          <div style={{ color: '#ff4d4f', marginBottom: 12, fontSize: 14 }}>{createError || error}</div>
        )}
        <div style={{ width: '100%', maxHeight: 260, overflowY: 'auto', marginTop: 2 }}>
          {invites.filter(invite => invite.status !== 'redeemed').length === 0 ? (
            <div style={{ color: '#b0b9d6', fontSize: 15, textAlign: 'center', marginTop: 8 }}>
              No invites created yet.
            </div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, width: '100%' }}>
              {invites.filter(invite => invite.status !== 'redeemed').map((invite, idx) => (
                <li key={invite.code} style={{
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: 9,
                  padding: '10px 12px',
                  marginBottom: 9,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 15,
                  color: invite.used ? '#b0b9d6' : '#fff',
                  opacity: invite.used ? 0.65 : 1,
                  border: invite.used ? '1.5px solid #38405a' : '1.5px solid #2d8cff44',
                  transition: 'box-shadow 0.18s',
                  boxShadow: copiedCode === invite.code ? '0 0 0 2px #2d8cff77' : 'none',
                }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {invite.code}
                    <button
                      style={{
                        marginLeft: 6,
                        background: 'none',
                        border: 'none',
                        color: '#2d8cff',
                        cursor: 'pointer',
                        fontSize: 14,
                        padding: 0,
                        opacity: 0.8,
                        transition: 'opacity 0.15s',
                        position: 'relative',
                      }}
                      title="Copy invite code"
                      aria-label="Copy invite code"
                      onClick={async () => {
                        await navigator.clipboard.writeText(invite.code);
                        setCopiedCode(invite.code);
                        setTimeout(() => setCopiedCode(null), 1200);
                      }}
                    >
                      {copiedCode === invite.code ? (
                        <span style={{ color: '#23e08a', fontWeight: 700, fontSize: 13, transition: 'color 0.18s' }}>Copied!</span>
                      ) : (
                        '📋'
                      )}
                    </button>
                  </span>
                  <span style={{ fontSize: 13, color: invite.used ? '#aaa' : '#2d8cff', marginLeft: 10 }}>
                    {invite.used ? 'Used' : 'Active'}
                  </span>
                  <span style={{ fontSize: 12, color: '#b0b9d6', marginLeft: 12 }}>{new Date(invite.createdAt).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
