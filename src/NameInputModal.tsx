import React, { useState } from 'react';

interface NameInputModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
  title?: string;
  label?: string;
  confirmText?: string;
}

export const NameInputModal: React.FC<NameInputModalProps> = ({
  open,
  onClose,
  onSubmit,
  title = 'Enter Name',
  label = 'Name',
  confirmText = 'Add',
}) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name cannot be empty.');
      return;
    }
    setError('');
    onSubmit(name.trim());
    setName('');
  }

  function handleClose() {
    setName('');
    setError('');
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
          {label}
        </div>
        <form
          onSubmit={handleSubmit}
          style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 18 }}
        >
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={label}
            autoFocus
            maxLength={32}
            style={{
              padding: '13px 16px',
              borderRadius: 12,
              border: error ? '1.5px solid #ff4d4f' : '1.5px solid #38405a',
              background: 'rgba(255,255,255,0.04)',
              color: '#fff',
              fontSize: 17,
              outline: 'none',
              transition: 'border 0.2s',
              marginBottom: 4,
            }}
            onFocus={e => (e.currentTarget.style.border = '1.5px solid #2d8cff')}
            onBlur={e => (e.currentTarget.style.border = error ? '1.5px solid #ff4d4f' : '1.5px solid #38405a')}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (name.trim()) {
                  handleSubmit(e as any);
                }
              }
            }}
          />
          {error && <div style={{ color: '#ff4d4f', marginBottom: 4, fontSize: 14 }}>{error}</div>}
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
              disabled={!name.trim()}
            >
              {confirmText}
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
