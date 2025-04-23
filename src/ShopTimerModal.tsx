import React, { useState } from "react";

interface ShopTimerModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (hours: number, minutes: number) => void;
  title?: string;
}

export const ShopTimerModal: React.FC<ShopTimerModalProps> = ({
  open,
  onClose,
  onSubmit,
  title = "Set Shop Timer",
}) => {
  const [hours, setHours] = useState(24);
  const [minutes, setMinutes] = useState(0);

  React.useEffect(() => {
    if (open) {
      setHours(24);
      setMinutes(0);
    }
  }, [open]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(hours, minutes);
  }

  function handleClose() {
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
          {title}
        </h2>
        <div style={{ color: '#aab3c5', marginBottom: 24, fontSize: 15, textAlign: 'center' }}>
          Select how long your shop should remain open.
        </div>
        <form
          onSubmit={handleSubmit}
          style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 18 }}
        >
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', alignItems: 'center' }}>
            <div>
              <label style={{ color: '#b9c1d1', fontSize: 15, marginRight: 7 }}>Hours</label>
              <input
                type="number"
                min={0}
                max={24}
                value={hours}
                onChange={e => setHours(Math.max(0, Math.min(24, parseInt(e.target.value) || 0)))}
                style={{
                  width: 70,
                  padding: '10px 10px',
                  borderRadius: 10,
                  border: '1.5px solid #38405a',
                  background: 'rgba(255,255,255,0.04)',
                  color: '#fff',
                  fontSize: 17,
                  outline: 'none',
                  textAlign: 'center',
                  marginRight: 7,
                }}
                onFocus={e => (e.currentTarget.style.border = '1.5px solid #2d8cff')}
                onBlur={e => (e.currentTarget.style.border = '1.5px solid #38405a')}
              />
            </div>
            <div>
              <label style={{ color: '#b9c1d1', fontSize: 15, marginRight: 7 }}>Minutes</label>
              <input
                type="number"
                min={0}
                max={59}
                value={minutes}
                onChange={e => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                style={{
                  width: 70,
                  padding: '10px 10px',
                  borderRadius: 10,
                  border: '1.5px solid #38405a',
                  background: 'rgba(255,255,255,0.04)',
                  color: '#fff',
                  fontSize: 17,
                  outline: 'none',
                  textAlign: 'center',
                }}
                onFocus={e => (e.currentTarget.style.border = '1.5px solid #2d8cff')}
                onBlur={e => (e.currentTarget.style.border = '1.5px solid #38405a')}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              type="submit"
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
              disabled={hours === 0 && minutes === 0}
            >
              Set Timer
            </button>
            <button
              type="button"
              style={{
                flex: 1,
                background: 'rgba(120,130,160,0.16)',
                color: '#c1c7d6',
                border: 'none',
                borderRadius: 12,
                fontWeight: 500,
                fontSize: 17,
                padding: '12px 0',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onClick={handleClose}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
