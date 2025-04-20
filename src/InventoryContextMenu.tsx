import React from "react";

interface InventoryContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onAdjustStock: () => void;
  onPriceHistory: () => void;
  onRecordSale: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
}

export function InventoryContextMenu({ x, y, onClose, onAdjustStock, onPriceHistory, onRecordSale, onDelete, deleteLabel }: InventoryContextMenuProps) {
  React.useEffect(() => {
    const handle = (e: MouseEvent) => {
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
        padding: 6,
        fontSize: 15,
      }}
      onContextMenu={e => e.preventDefault()}
    >
      <div
        style={{ padding: "8px 16px", cursor: "pointer", borderRadius: 6, userSelect: "none" }}
        onMouseDown={e => {
          e.preventDefault();
          onAdjustStock();
          onClose();
        }}
      >
        Adjust Stock…
      </div>
      <div
        style={{ padding: "8px 16px", cursor: "pointer", borderRadius: 6, userSelect: "none" }}
        onMouseDown={e => {
          e.preventDefault();
          onRecordSale();
          onClose();
        }}
      >
        Record Sale…
      </div>
      <div
        style={{ padding: "8px 16px", cursor: "pointer", borderRadius: 6, userSelect: "none" }}
        onMouseDown={e => {
          e.preventDefault();
          onPriceHistory();
          onClose();
        }}
      >
        View Price History…
      </div>
      {onDelete && (
        <div
          style={{
            padding: "8px 16px",
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
            if (window.confirm('Are you sure you want to delete this item? This cannot be undone.')) {
              onDelete();
            }
            onClose();
          }}
        >
          {deleteLabel ?? 'Delete Item'}
        </div>
      )}
    </div>
  );
}
