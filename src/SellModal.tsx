import React, { useState, useEffect } from "react";
import { Modal } from "./Modal";

interface SellModalProps {
  open: boolean;
  onClose: () => void;
  onSell: (amount: number, price: number, markUnowned?: boolean) => void;
  itemName?: string;
  userPrice?: number;
  defaultPrice?: number;
}

export function SellModal({ open, onClose, onSell, itemName, userPrice, defaultPrice }: SellModalProps) {
  const initialPrice = userPrice !== undefined ? String(userPrice) : (defaultPrice !== undefined ? String(defaultPrice) : "");
  const [amount, setAmount] = useState(1);
  const [price, setPrice] = useState(initialPrice);
  const [error, setError] = useState("");

  useEffect(() => {
    setPrice(initialPrice);
  }, [userPrice, defaultPrice, open]);

  function handleSubmit(e: React.FormEvent, markUnowned = false) {
    e.preventDefault();
    const amt = Number(amount);
    const prc = Number(price);
    console.debug('[SellModal] handleSubmit called', { amount, price, amt, prc, markUnowned });
    if (!amt || amt < 1) {
      setError("Enter a valid amount");
      console.warn('[SellModal] Invalid amount:', amt);
      return;
    }
    if (!prc || prc <= 0) {
      setError("Enter a valid price");
      console.warn('[SellModal] Invalid price:', prc);
      return;
    }
    setError("");
    console.info('[SellModal] Calling onSell', { amt, prc, markUnowned });
    onSell(amt, prc, markUnowned);
    setAmount(1);
    setPrice(initialPrice);
  }

  return (
    <Modal open={open} onClose={onClose}>
      <h2>Sell {itemName}</h2>
      <form onSubmit={e => handleSubmit(e, false)} style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 280 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Number of items</span>
          <input
            type="number"
            min={1}
            value={amount}
            onChange={e => setAmount(Number(e.target.value))}
            required
            autoFocus
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Sold at price (per item)</span>
          <input
            type="number"
            min={0}
            step={1}
            value={price}
            onChange={e => setPrice(e.target.value)}
            required
          />
        </label>
        {error && <div style={{ color: '#f55', fontSize: '0.97rem' }}>{error}</div>}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button type="submit" style={{ background: '#4caf50', color: '#fff', fontWeight: 600, border: 'none', borderRadius: 8, padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/placeholder-sell.png" alt="Sell" style={{ width: 24, height: 24, objectFit: 'contain' }} />
          </button>
          <button type="button" style={{ background: '#2d8cff', color: '#fff', fontWeight: 600, border: 'none', borderRadius: 8, padding: '10px 20px' }} onClick={e => handleSubmit(e, true)}>Sell and Mark As Unowned</button>
          <button type="button" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
