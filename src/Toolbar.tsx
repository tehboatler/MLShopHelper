// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React from "react";
import { Dropdown } from "./Dropdown";

interface ToolbarProps {
  onSetIGN: () => void;
  onAbout: () => void;
  ign: string;
  compactMode: boolean;
  setCompactMode: (val: boolean) => void;
}

export function Toolbar({ onSetIGN, onAbout, ign, compactMode, setCompactMode }: ToolbarProps) {
  return (
    <header className="toolbar">
      <div className="toolbar-appname">mlshophelper</div>
      <div className="toolbar-actions">
        <Dropdown label="User">
          <div className="dropdown-item" onClick={onSetIGN}>Set IGN</div>
          <div className="dropdown-item" style={{ cursor: "default", color: "#888" }}>IGN: <b>{ign || "Not set"}</b></div>
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
    </header>
  );
}
