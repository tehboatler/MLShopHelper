import React, { useEffect, useRef } from "react";

interface ContextMenuProps {
  x: number;
  y: number;
  open: boolean;
  onClose: () => void;
  actions: { label: string; icon?: React.ReactNode; onClick: () => void }[];
}

export function ContextMenu({ x, y, open, onClose, actions }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      ref={ref}
      className="context-menu"
      style={{ top: y, left: x, zIndex: 3000, position: "fixed" }}
      role="menu"
    >
      {actions.map((a, i) => (
        <button
          className="context-menu-item"
          key={i}
          onClick={() => { a.onClick(); onClose(); }}
          role="menuitem"
        >
          {a.icon && <span style={{ marginRight: 8 }}>{a.icon}</span>}
          {a.label}
        </button>
      ))}
    </div>
  );
}
