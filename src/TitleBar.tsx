import React from "react";
import { Window } from "@tauri-apps/api/window";
import "./TitleBar.css";

const TitleBar: React.FC = () => {
  const handleMinimize = () => Window.getCurrent().minimize();
  const handleMaximize = () => Window.getCurrent().toggleMaximize();
  const handleClose = () => Window.getCurrent().close();

  // Always render the title bar; controls will work when Tauri is ready
  return (
    <div className="titlebar" onDoubleClick={handleMaximize}>
      <div className="titlebar-title">MLShopHelper</div>
      <div className="titlebar-controls">
        <button className="titlebar-btn" title="Minimize" onClick={handleMinimize} tabIndex={-1}>
          <svg width="10" height="10" viewBox="0 0 10 10"><rect x="2" y="7" width="6" height="1" rx="0.5" fill="white"/></svg>
        </button>
        <button className="titlebar-btn" title="Maximize/Restore" onClick={handleMaximize} tabIndex={-1}>
          <svg width="10" height="10" viewBox="0 0 10 10"><rect x="2" y="2" width="6" height="6" rx="1" fill="white"/></svg>
        </button>
        <button className="titlebar-btn titlebar-btn-close" title="Close" onClick={handleClose} tabIndex={-1}>
          <svg width="10" height="10" viewBox="0 0 10 10"><line x1="2" y1="2" x2="8" y2="8" stroke="white" strokeWidth="1.2"/><line x1="8" y1="2" x2="2" y2="8" stroke="white" strokeWidth="1.2"/></svg>
        </button>
      </div>
    </div>
  );
};

export default TitleBar;
