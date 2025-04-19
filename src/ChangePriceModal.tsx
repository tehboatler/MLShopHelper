import React, { useState, useContext, useEffect } from "react";
import { Modal } from "./Modal";
import { UISettingsContext } from "./App";
import { invoke } from "@tauri-apps/api/core";
import type { PriceEntry } from "./PriceHistoryModal";

interface ChangePriceModalProps {
  open: boolean;
  onClose: () => void;
  currentPrice: number;
  onSetPrice: (newPrice: number) => void;
  itemId: number;
  author: string;
  title?: string;
  itemName?: string; // Add itemName as a prop
}

function formatRelativeDate(dateString: string): string {
  const now = new Date("2025-04-19T15:10:38+10:00");
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays > 0) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  if (diffHours > 0) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffMin > 0) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  return "just now";
}

export function ChangePriceModal({ open, onClose, currentPrice, onSetPrice, itemId, author, title, itemName }: ChangePriceModalProps) {
  const uiSettings = useContext(UISettingsContext);
  const round50k = uiSettings?.round50k ?? false;
  const showUnsold = uiSettings?.showUnsold ?? false;
  const setRound50k = uiSettings?.setRound50k;
  const setShowUnsold = uiSettings?.setShowUnsold;

  const [customPrice, setCustomPrice] = useState("");
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState("");
  const [priceHistory, setPriceHistory] = useState<PriceEntry[]>([]);
  const [sortBy, setSortBy] = useState<'date'|'price'>('date');
  const [sortDir, setSortDir] = useState<'desc'|'asc'>('desc');
  const [selectedHistoryIdx, setSelectedHistoryIdx] = useState<number|null>(null);

  useEffect(() => {
    setError("");
  }, [customPrice, percent]);

  useEffect(() => {
    if (!open || !itemId) return;
    (async () => {
      const entries = await invoke<PriceEntry[]>("get_price_history", { itemId });
      setPriceHistory(entries);
    })();
  }, [open, itemId]);

  function computeNewPrice() {
    const manualVal = parseFloat(customPrice);
    const percentVal = Number(percent);
    let newPrice = currentPrice;
    const hasManual = !isNaN(manualVal) && manualVal > 0;
    const hasPercent = !isNaN(percentVal) && percentVal !== 0;
    if (hasManual) {
      newPrice = Math.round(manualVal);
    } else if (hasPercent) {
      newPrice = Math.round(currentPrice * (1 + percentVal / 100));
    }
    if (round50k && (hasManual || hasPercent)) {
      newPrice = Math.round(newPrice / 50000) * 50000;
    }
    return newPrice;
  }

  function getSortedHistory() {
    let arr = [...priceHistory];
    // Filter unsold if toggle is off
    if (!showUnsold) {
      arr = arr.filter(entry => entry.sold);
    }
    arr.sort((a, b) => {
      if (sortBy === 'date') {
        const da = new Date(a.date).getTime();
        const db = new Date(b.date).getTime();
        return sortDir === 'desc' ? db - da : da - db;
      } else {
        return sortDir === 'desc' ? b.price - a.price : a.price - b.price;
      }
    });
    return arr;
  }

  function handleSort(col: 'date'|'price') {
    if (sortBy === col) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  }

  async function handleApply() {
    const manualVal = parseFloat(customPrice);
    const percentVal = Number(percent);
    const hasManual = !isNaN(manualVal) && manualVal > 0;
    const hasPercent = !isNaN(percentVal) && percentVal !== 0;
    let newPrice = currentPrice;
    if (hasManual) {
      newPrice = Math.round(manualVal);
    } else if (hasPercent) {
      newPrice = Math.round(currentPrice * (1 + percentVal / 100));
    }
    if (round50k && (hasManual || hasPercent)) {
      newPrice = Math.round(newPrice / 50000) * 50000;
    }
    if (!hasManual && !hasPercent) {
      setError("Enter a new price or a percentage to adjust.");
      return;
    } else if (newPrice <= 0) {
      setError("Price must be greater than zero.");
      return;
    }
    try {
      const now = new Date().toISOString();
      console.log('Calling add_price_history', { itemId, price: newPrice, date: now, author, sold: false });
      await invoke("add_price_history", {
        itemId,
        price: newPrice,
        date: now,
        author,
        sold: false,
      });
      // Update the item's current_selling_price in the items table
      // Always use the itemName prop from parent, do not fallback to window
      if (itemName) {
        await invoke("update_item", { id: itemId, name: itemName, currentSellingPrice: newPrice });
      } else {
        // fallback: don't block price update, but warn
        console.warn('Item name not provided to ChangePriceModal; current_selling_price not updated');
      }
      onSetPrice(newPrice);
      setCustomPrice("");
      setPercent(0);
      onClose();
    } catch (e: any) {
      setError("Failed to save price. Please try again. " + (e?.message || e));
      console.error('add_price_history failed', e);
    }
  }

  function handleCustomPriceChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCustomPrice(e.target.value);
    if (e.target.value) setPercent(0);
  }

  function handlePercentChange(val: number) {
    setPercent(val);
    setCustomPrice("");
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 500 }}>
        <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Inputs at top */}
          <div style={{paddingBottom: 8, flex: '0 0 auto'}}>
            <div style={{display:'flex',gap:18,alignItems:'center',flexWrap:'wrap',marginBottom:8}}>
              <label style={{display:'flex',alignItems:'center',gap:6}}>
                <input type="checkbox" checked={round50k} onChange={e => setRound50k && setRound50k(e.target.checked)} />
                <span style={{fontWeight:500, fontSize:'0.95rem'}}>Round new price to nearest 50,000</span>
              </label>
              <label style={{display:'flex',alignItems:'center',gap:6}}>
                <input type="checkbox" checked={showUnsold} onChange={e => setShowUnsold && setShowUnsold(e.target.checked)} />
                <span style={{fontWeight:500, fontSize:'0.95rem'}}>Show unsold prices</span>
              </label>
            </div>
            <div style={{display:'flex',gap:24,flexWrap:'wrap',width:'100%',marginBottom:0}}>
              <label style={{display:'flex',flexDirection:'column',gap:6,flex:'1 1 220px',width:'100%'}}>
                <span style={{color:'#e0e0e0',fontWeight:500,fontSize:'0.95rem'}}>Set new price</span>
                <input
                  type="number"
                  value={customPrice}
                  onChange={e => setCustomPrice(e.target.value)}
                  placeholder="Manual input"
                  style={{width: '100%', fontSize:'0.95rem', padding:'6px 8px', height:38, boxSizing:'border-box'}}
                />
              </label>
              <label style={{display:'flex',flexDirection:'column',gap:6,flex:'1 1 120px',width:'100%'}}>
                <span style={{color:'#e0e0e0',fontWeight:500,fontSize:'0.95rem'}}>Or adjust by %</span>
                <div style={{display:'flex',alignItems:'center',gap:6,flex:'1 1 auto',width:'100%',height:38}}>
                  <input
                    type="number"
                    value={percent}
                    onChange={e => handlePercentChange(Number(e.target.value))}
                    placeholder="e.g. 10 for +10%"
                    style={{width:70,fontSize:'0.95rem',padding:'6px 8px',height:38,boxSizing:'border-box'}}
                  />
                  <div style={{display:'flex',gap:6,flex:1}}>
                    <button type="button"
                      onClick={()=>handlePercentChange(percent+1)}
                      style={{flex:1,padding:'0 10px',fontSize:'0.95rem',height:38,background:'#2d8cff',color:'#fff',border:'none',borderRadius:4,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>+1%</button>
                    <button type="button"
                      onClick={()=>handlePercentChange(percent-1)}
                      style={{flex:1,padding:'0 10px',fontSize:'0.95rem',height:38,background:'#2d8cff',color:'#fff',border:'none',borderRadius:4,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>−1%</button>
                  </div>
                </div>
              </label>
            </div>
            {error && <div style={{color:'#f55',marginTop:4,fontSize:'0.95rem'}}>{error}</div>}
          </div>
          {/* Table Section */}
          <div style={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="styled-table" style={{ fontSize: '0.89rem', lineHeight: 1.13, width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th style={{ width: 28 }}></th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('price')}>
                      Price {sortBy === 'price' ? (sortDir === 'desc' ? '▼' : '▲') : ''}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('date')}>
                      Date {sortBy === 'date' ? (sortDir === 'desc' ? '▼' : '▲') : ''}
                    </th>
                    <th>Author</th>
                    <th>Status</th>
                  </tr>
                </thead>
              </table>
            </div>
            <div style={{ overflowY: 'auto', flex: '1 1 0', minHeight: 0 }}>
              <table className="styled-table" style={{ fontSize: '0.89rem', lineHeight: 1.13, width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <tbody>
                  {getSortedHistory().map((entry, i) => (
                    <tr key={i} className={entry.sold ? "sold-row" : "unsold-row"} style={{ background: selectedHistoryIdx === i ? '#2d8cff44' : '', height: 22 }}>
                      <td><input type="radio" name="historyPick" checked={selectedHistoryIdx === i} onChange={() => {
                        setSelectedHistoryIdx(i);
                        setCustomPrice(entry.price.toString());
                      }} /></td>
                      <td style={{ cursor: 'pointer' }} onClick={() => {
                        setSelectedHistoryIdx(i);
                        setCustomPrice(entry.price.toString());
                      }}>{entry.price.toLocaleString()}</td>
                      <td>{formatRelativeDate(entry.date)}</td>
                      <td>{entry.author}</td>
                      <td>{entry.sold ? <span style={{ color: '#4caf50', fontWeight: 600 }}>Sold</span> : <span style={{ color: '#bbb' }}>Unsold</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        {/* Price display and actions anchored at the bottom, not absolute */}
        <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', padding: '24px 40px 0 40px', background: 'inherit' }}>
          <div style={{ display: 'flex', width: '100%', justifyContent: 'center', alignItems: 'stretch', marginBottom: 12, gap: 16 }}>
            <div style={{ flex: '1 1 50%', background: '#232b3c', borderRadius: 10, padding: '16px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px #0001' }}>
              <div style={{ fontSize: '1.12rem', fontWeight: 600, color: '#bbb', marginBottom: 4 }}>Current Price</div>
              <div style={{ fontSize: '2.1rem', fontWeight: 700, color: '#fff', textAlign: 'center', letterSpacing: '0.5px' }}>{currentPrice.toLocaleString()}</div>
            </div>
            <div style={{ flex: '1 1 50%', background: '#1e2730', borderRadius: 10, padding: '16px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px #0001' }}>
              <div style={{ fontSize: '1.12rem', fontWeight: 600, color: '#2d8cff', marginBottom: 4 }}>New Price</div>
              <div style={{ fontSize: '2.1rem', fontWeight: 700, color: '#2d8cff', textAlign: 'center', letterSpacing: '0.5px' }}>{computeNewPrice().toLocaleString()}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
            <button className="price-actions" style={{ fontSize: '0.97rem', padding: '7px 16px' }} onClick={handleApply}>
              Apply
            </button>
            <button className="price-actions" style={{ fontSize: '0.97rem', padding: '7px 16px', background: '#444', color: '#eee' }} onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
      <div className="modal-footer">
      </div>
    </Modal>
  );
}
