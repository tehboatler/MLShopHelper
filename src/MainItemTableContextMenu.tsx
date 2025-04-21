import React from "react";

interface MainItemTableContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onPriceHistory: () => void;
  onChangePrice: () => void;
  onDelete: () => void;
  deleteLabel?: string;
}

export function MainItemTableContextMenu({
  x,
  y,
  onClose,
  onPriceHistory,
  onChangePrice,
  onDelete,
  deleteLabel,
}: MainItemTableContextMenuProps) {
  React.useEffect(() => {
    const handle = (_: MouseEvent) => {
      onClose();
    };
    window.addEventListener("mousedown", handle);
    return () => window.removeEventListener("mousedown", handle);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        top: y,
        left: x,
        background: "#232323",
        color: "#fff",
        borderRadius: 8,
        boxShadow: "0 2px 8px #0004",
        minWidth: 160,
        zIndex: 3000,
        padding: 8,
      }}
      role="menu"
    >
      <div
        style={{
          padding: "10px 18px",
          cursor: "pointer",
          borderRadius: 6,
          userSelect: "none",
        }}
        onMouseDown={e => {
          e.preventDefault();
          onPriceHistory();
          onClose();
        }}
        role="menuitem"
      >
        View Price History
      </div>
      <div
        style={{
          padding: "10px 18px",
          cursor: "pointer",
          borderRadius: 6,
          userSelect: "none",
        }}
        onMouseDown={e => {
          e.preventDefault();
          onChangePrice();
          onClose();
        }}
        role="menuitem"
      >
        Change Price
      </div>
      <div
        style={{
          padding: "10px 18px",
          cursor: "pointer",
          borderRadius: 6,
          userSelect: "none",
          color: "#fff",
          background: "#e74c3c",
          marginTop: 3,
          fontWeight: 600,
          transition: 'background 0.15s, color 0.15s',
        }}
        onMouseDown={e => {
          e.preventDefault();
          if (window.confirm('Are you sure you want to delete this item from the database? This cannot be undone.')) {
            onDelete();
          }
          onClose();
        }}
        role="menuitem"
      >
        {deleteLabel ?? 'Delete from database'}
      </div>
    </div>
  );
}
