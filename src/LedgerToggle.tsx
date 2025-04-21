import React, { useState } from "react";

export type LedgerMode = "personal" | "global";

interface LedgerToggleProps {
  mode: LedgerMode;
  setMode: (mode: LedgerMode) => void;
}

export const LedgerToggle: React.FC<LedgerToggleProps> = ({ mode, setMode }) => {
  return (
    <div
      style={{
        display: 'flex',
        gap: 0,
        alignItems: 'center',
        marginBottom: 18,
        width: '100%',
        background: '#181b22',
        border: '1.5px solid #2d8cff',
        borderRadius: 6,
        boxShadow: '0 2px 8px #0002',
        overflow: 'hidden',
      }}
    >
      <button
        style={{
          background: mode === "personal" ? 'linear-gradient(90deg, #2d8cff 80%, #1b4b8c 100%)' : 'transparent',
          color: mode === "personal" ? '#fff' : '#b0b9d6',
          border: 'none',
          borderRadius: 0,
          padding: '12px 0',
          fontWeight: 700,
          cursor: 'pointer',
          outline: mode === "personal" ? '2px solid #2d8cff' : 'none',
          opacity: mode === "personal" ? 1 : 0.85,
          flex: 1,
          width: 0,
          fontSize: 16,
          letterSpacing: 0.2,
          transition: 'background .18s, color .18s, outline .13s',
          boxShadow: mode === "personal" ? '0 2px 8px #2d8cff22' : 'none',
        }}
        onClick={() => setMode("personal")}
        aria-pressed={mode === "personal"}
      >
        Personal
      </button>
      <button
        style={{
          background: mode === "global" ? 'linear-gradient(90deg, #2d8cff 80%, #1b4b8c 100%)' : 'transparent',
          color: mode === "global" ? '#fff' : '#b0b9d6',
          border: 'none',
          borderRadius: 0,
          padding: '12px 0',
          fontWeight: 700,
          cursor: 'pointer',
          outline: mode === "global" ? '2px solid #2d8cff' : 'none',
          opacity: mode === "global" ? 1 : 0.85,
          flex: 1,
          width: 0,
          fontSize: 16,
          letterSpacing: 0.2,
          transition: 'background .18s, color .18s, outline .13s',
          boxShadow: mode === "global" ? '0 2px 8px #2d8cff22' : 'none',
        }}
        onClick={() => setMode("global")}
        aria-pressed={mode === "global"}
      >
        Global
      </button>
    </div>
  );
};
