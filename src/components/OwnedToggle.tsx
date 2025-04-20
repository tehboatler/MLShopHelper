import React from "react";

interface OwnedToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
}

export function OwnedToggle({ checked, onChange }: OwnedToggleProps) {
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onChange(!checked); }}
      aria-pressed={checked}
      style={{
        width: 44,
        height: 26,
        borderRadius: 13,
        border: '2px solid #2d8cff',
        background: checked ? '#2d8cff' : '#eee',
        position: 'relative',
        cursor: 'pointer',
        outline: 'none',
        transition: 'background 0.18s',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: checked ? 'flex-end' : 'flex-start',
        padding: 0,
      }}
      tabIndex={0}
    >
      <span
        style={{
          display: 'block',
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: checked ? '0 0 4px #2d8cff99' : '0 0 2px #888',
          margin: 2,
          transition: 'box-shadow 0.18s',
        }}
      />
    </button>
  );
}
