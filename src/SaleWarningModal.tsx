import React from "react";
import './SaleWarningModal.css';

interface SaleWarningModalProps {
  open: boolean;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
  itemName?: string;
  price?: number | null;
}

export const SaleWarningModal: React.FC<SaleWarningModalProps> = ({ open, onConfirm, onCancel, itemName, price }) => {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!open) return null;

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err: any) {
      setError(err?.message || 'Failed to log sale.');
      setLoading(false);
      return;
    }
    setLoading(false);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0,0,0,0.54)',
        zIndex: 3001,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: loading ? 'none' : 'auto',
        userSelect: loading ? 'none' : 'auto',
      }}
      onClick={loading ? undefined : onCancel}
    >
      <div
        style={{
          background: '#232b3c',
          borderRadius: 16,
          boxShadow: '0 2px 24px #0006',
          minWidth: 260,
          maxWidth: 420,
          width: 'fit-content',
          padding: 30,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          opacity: loading ? 0.7 : 1,
          pointerEvents: loading ? 'none' : 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: 24, textAlign: 'center', width: '100%' }}>
          <h2 style={{ marginBottom: 12 }}>Log Sale for Today?</h2>
          <div style={{
            fontSize: 17,
            fontWeight: 600,
            color: '#ffb700',
            marginTop: 16,
            marginBottom: 2,
            textAlign: 'center',
          }}>
            {itemName ? `Quick Sell: ${itemName}` : 'Quick Sell'}
          </div>
          {typeof price === 'number' && (
            <div className="sale-warning-price">
              {price.toLocaleString()}<br />
              <span className="sale-warning-price-mesos">mesos</span>
            </div>
          )}
          <p style={{ fontSize: 16, marginBottom: 16 }}>
            You are about to log a sale for <b>{itemName || 'this item'}</b> at a price of <b>{price !== null && price !== undefined ? price : 'unknown'}</b>.<br /><br />
            <b>Only the first sale of each item per day</b> will be publicly logged to prevent price spam and griefing.<br />
            <br />
            <b>All other sales</b> of this item today will <b>not</b> be public, but will still update your inventory/ledger records privately.<br /><br />
            <span style={{ color: '#ffb300', fontWeight: 600, fontSize: 15 }}>
              Please <u>only</u> log genuine sales. Honesty is greatly appreciated and helps keep the data accurate for everyone!
            </span>
          </p>
          {error && (
            <div style={{ color: '#ff4c4c', fontWeight: 600, marginBottom: 12 }}>{error}</div>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 24 }}>
            <button
              onClick={loading ? undefined : onCancel}
              disabled={loading}
              style={{ padding: '8px 22px', borderRadius: 7, background: '#ddd', color: '#333', fontWeight: 500, border: 'none', fontSize: 15, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={loading ? undefined : handleConfirm}
              disabled={loading}
              style={{ padding: '8px 22px', borderRadius: 7, background: '#2d8cff', color: '#fff', fontWeight: 600, border: 'none', fontSize: 15, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer', position: 'relative' }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="spinner" style={{ width: 18, height: 18, border: '3px solid #fff', borderTop: '3px solid #2d8cff', borderRadius: '50%', animation: 'spin 1s linear infinite', display: 'inline-block' }} />
                  Logging...
                </span>
              ) : (
                'Log Sale'
              )}
            </button>
          </div>
        </div>
        <button
          onClick={loading ? undefined : onCancel}
          disabled={loading}
          style={{ position: 'absolute', top: 18, right: 18, background: 'none', border: 'none', fontSize: 22, fontWeight: 600, color: '#aaa', cursor: loading ? 'not-allowed' : 'pointer' }}
          aria-label="Close"
        >
          ×
        </button>
        {/* Spinner keyframes */}
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
};
