import React, { useState, useEffect } from "react";

interface StockDialogProps {
  open: boolean;
  onClose: () => void;
  onStock: (characterId: string, amount: number) => void;
  characters: { id: string; name: string; shop: { itemCounts: Record<number, number> } }[];
  itemName: string;
  itemId: number;
  defaultStock: number;
}

export function StockDialog({ open, onClose, onStock, characters, itemName, itemId, defaultStock }: StockDialogProps) {
  // Use defaultStock as the initial value for amount, and selected character as initial character
  const initialCharId = characters.find(c => c.shop.itemCounts[itemId] === defaultStock)?.id || characters[0]?.id || "";
  const [characterId, setCharacterId] = useState(initialCharId);
  const [amount, setAmount] = useState(defaultStock);

  // When dialog opens, update to current stock for selected character
  useEffect(() => {
    setCharacterId(initialCharId);
    setAmount(defaultStock);
  }, [open, itemId, defaultStock, initialCharId]);

  // When character changes, update amount to their current stock
  useEffect(() => {
    const char = characters.find(c => c.id === characterId);
    const stock = char?.shop?.itemCounts?.[itemId] ?? 0;
    setAmount(stock);
  }, [characterId, characters, itemId]);

  if (!open) return null;

  function adjust(val: number) {
    setAmount(a => Math.max(0, a + val));
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#000a', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ background: '#232323', borderRadius: 10, padding: 28, minWidth: 340, boxShadow: '0 2px 16px #0006', color: '#fff' }}>
        <h3 style={{ margin: 0, marginBottom: 18, fontSize: 20 }}>Adjust Stock for "{itemName}"</h3>
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', marginBottom: 8 }}>Character:</label>
          <select value={characterId} onChange={e => setCharacterId(e.target.value)} style={{ width: '100%', fontSize: 15, padding: 6, borderRadius: 4, border: '1px solid #444', background: '#191a1b', color: '#fff' }}>
            {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', marginBottom: 8 }}>Stock Amount:</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="button" onClick={() => adjust(-5)} style={{ padding: '6px 12px', fontSize: 16, borderRadius: 4, border: '1px solid #444', background: '#191a1b', color: '#fff', cursor: 'pointer' }}>-5</button>
            <button type="button" onClick={() => adjust(-1)} style={{ padding: '6px 12px', fontSize: 16, borderRadius: 4, border: '1px solid #444', background: '#191a1b', color: '#fff', cursor: 'pointer' }}>-1</button>
            <input type="number" min={0} value={amount} onChange={e => setAmount(Number(e.target.value))} style={{ width: 90, fontSize: 15, padding: 6, borderRadius: 4, border: '1px solid #444', background: '#191a1b', color: '#fff', textAlign: 'center' }} />
            <button type="button" onClick={() => adjust(1)} style={{ padding: '6px 12px', fontSize: 16, borderRadius: 4, border: '1px solid #444', background: '#191a1b', color: '#fff', cursor: 'pointer' }}>+1</button>
            <button type="button" onClick={() => adjust(5)} style={{ padding: '6px 12px', fontSize: 16, borderRadius: 4, border: '1px solid #444', background: '#191a1b', color: '#fff', cursor: 'pointer' }}>+5</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #888', color: '#fff', borderRadius: 4, padding: '6px 18px', fontSize: 15, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onStock(characterId, amount)} style={{ background: '#2d8cff', border: 'none', color: '#fff', borderRadius: 4, padding: '6px 18px', fontSize: 15, cursor: 'pointer', fontWeight: 600 }}>Set Stock</button>
        </div>
      </div>
    </div>
  );
}
