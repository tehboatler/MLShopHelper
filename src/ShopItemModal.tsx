import React, { useState } from "react";

interface ShopItemModalProps {
  open: boolean;
  onClose: () => void;
  onSell: (count: number) => void;
  onRemove: () => void;
  itemName: string;
  stockCount: number;
  price?: number;
}

export function ShopItemModal({ open, onClose, onSell, onRemove, itemName, stockCount, price }: ShopItemModalProps) {
  const [sellCount, setSellCount] = useState(1);

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#000a', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ background: '#232323', borderRadius: 10, padding: 28, minWidth: 340, boxShadow: '0 2px 16px #0006', color: '#fff' }}>
        <h3 style={{ margin: 0, marginBottom: 18, fontSize: 20 }}>{itemName}</h3>
        <div style={{ marginBottom: 16, fontSize: 16 }}>
          <div>Stock: <span style={{ fontWeight: 700, color: '#2d8cff' }}>{stockCount}</span></div>
          {price !== undefined && <div>Price: <span style={{ color: '#2d8cff' }}>{price.toLocaleString()}</span></div>}
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', marginBottom: 8 }}>How many sold?</label>
          <input type="number" min={1} max={stockCount} value={sellCount} onChange={e => setSellCount(Math.max(1, Math.min(stockCount, Number(e.target.value))))} style={{ width: 80, fontSize: 15, padding: 6, borderRadius: 4, border: '1px solid #444', background: '#191a1b', color: '#fff' }} />
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 12 }}>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #888', color: '#fff', borderRadius: 4, padding: '6px 18px', fontSize: 15, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onSell(sellCount)} style={{ background: '#2d8cff', border: 'none', color: '#fff', borderRadius: 4, padding: '6px 18px', fontSize: 15, cursor: 'pointer', fontWeight: 600 }}>Record Sale</button>
          <button onClick={onRemove} style={{ background: '#e74c3c', border: 'none', color: '#fff', borderRadius: 4, padding: '6px 18px', fontSize: 15, cursor: 'pointer', fontWeight: 600 }}>Remove from Shop</button>
        </div>
      </div>
    </div>
  );
}
