// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React from "react";
import { Dropdown } from "./Dropdown";

interface ToolbarProps {
  onSetIGN: () => void;
  onAbout: () => void;
  ign: string;
}

export function Toolbar({ onSetIGN, onAbout, ign }: ToolbarProps) {
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
        </Dropdown>
      </div>
    </header>
  );
}
