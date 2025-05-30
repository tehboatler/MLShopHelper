import React, { useState, useEffect} from "react";
import type { Character, Item } from "./types";
import { ChangePriceModal } from "./ChangePriceModal";
import { getLatestUserPriceEntryRX } from './priceHistoryRXDB';
import { SaleWarningModal } from "./SaleWarningModal";

interface StockModalProps {
  open: boolean;
  onClose: () => void;
  itemId: string;
  itemName: string;
  item?: Item;
  userPriceMap: Map<string, { price: number }>;
  characters: Character[];
  selectedCharacterId: string | null;
  setToast: (toast: { msg: string; visible: boolean }) => void;
  onAddToStore?: (characterId: string, itemId: string, pStats?: {
    mean?: number;
    std?: number;
    p0?: number;
    p25?: number;
    p50?: number;
    p75?: number;
    p100?: number;
    num_outlier?: number;
    sum_bundle?: number;
    search_item_timestamp?: string;
    search_results_captured?: number;
    price?: number;
  }) => void;
  onRemoveFromStore?: (characterId: string, itemId: string) => void;
  handleChangePrice: (itemId: string, newPrice: number, notes?: string, isSale?: boolean, itemName?: string) => Promise<void>;
  priceHistoryData: any; // Add this prop
}

export function StockModal({
  open,
  onClose,
  itemId,
  itemName,
  item,
  userPriceMap,
  characters,
  selectedCharacterId,
  setToast,
  onAddToStore,
  onRemoveFromStore,
  handleChangePrice,
  // priceHistoryData, // Add this prop
}: StockModalProps) {
  // Default to selected character or first
  const [characterId, setCharacterId] = useState<string>(selectedCharacterId || characters[0]?.id || "");
  const [changePriceOpen, setChangePriceOpen] = useState(false);
  const [latestPrice, setLatestPrice] = useState<number | null>(null);
  const [alreadyLogged24h, setAlreadyLogged24h] = useState(false);
  const [showSaleWarning, setShowSaleWarning] = useState(false);
  const persistentUserId = typeof window !== 'undefined' ? localStorage.getItem('persistentUserId') : null;

  useEffect(() => {
    setCharacterId(selectedCharacterId || characters[0]?.id || "");
  }, [open, selectedCharacterId, itemId, userPriceMap, characters]);

  useEffect(() => {
    if (open) {
      (window as any).__modalOpen = true;
    } else {
      (window as any).__modalOpen = false;
    }
    return () => {
      (window as any).__modalOpen = false;
    };
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    async function checkLastSold() {
      console.log('[StockModal] Checking last sold:', { persistentUserId, itemId });
      if (!persistentUserId || !itemId) {
        console.log('[StockModal] Missing user or item ID, disabling alreadyLogged24h');
        setAlreadyLogged24h(false);
        return;
      }
      // Query all price history entries for this user and item, sorted by date desc
      const db = await import('./rxdb').then(m => m.getDb());
      const entries = await db.priceHistory.find({
        selector: {
          author: persistentUserId,
          itemId,
          date: { $exists: true }
        },
        sort: [{ date: 'desc' }]
      }).exec();
      console.log('[StockModal] All price history entries:', entries);
      const now = Date.now();
      let found = false;
      for (const entry of entries) {
        if (!entry.date) continue;
        const entryTime = new Date(entry.date).getTime();
        if (isNaN(entryTime)) continue;
        if (now - entryTime > 24 * 60 * 60 * 1000) break; // Stop if older than 24h
        if (entry.sold) {
          found = true;
          break;
        }
      }
      if (!cancelled) setAlreadyLogged24h(found);
      console.log(`[StockModal] alreadyLogged24h set to:`, found);
    }
    checkLastSold();
    return () => { cancelled = true; };
  }, [persistentUserId, itemId, open]);

  useEffect(() => {
    if (open && persistentUserId && itemId) {
      getLatestUserPriceEntryRX(persistentUserId, itemId).then(entry => {
        setLatestPrice(typeof entry?.price === 'number' ? entry.price : null);
      });
    } else {
      setLatestPrice(null);
    }
  }, [open, itemId]);

  const modalRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Only handle modal-level keyboard shortcuts and focus trap
    function handleKeyDown(e: KeyboardEvent) {
      if (!open) return;
      if (e.key.toLowerCase() === 'q') {
        e.preventDefault();
        handleQuickSell();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Tab' && modalRef.current) {
        // Focus trap
        const focusables = modalRef.current.querySelectorAll<HTMLElement>([
          'button:not([disabled])',
          'select:not([disabled])',
          'input:not([disabled])',
          '[tabindex]:not([tabindex="-1"])'
        ].join(','));
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleQuickSell, onClose]);

  // --- Handlers ---
  async function handleQuickSell() {
    // If alreadyLogged24h, show warning and block immediately
    if (alreadyLogged24h) {
      setToast({ msg: `You've already logged a sale for this item in the last 24 hours.`, visible: true });
      return;
    }
    setShowSaleWarning(true);
  }

  async function confirmSaleWarning() {
    // Double-check 24h logic to avoid race
    if (alreadyLogged24h) {
      setToast({ msg: `You've already logged a sale for this item in the last 24 hours.`, visible: true });
      setShowSaleWarning(false);
      onClose();
      return;
    }
    try {
      await handleChangePrice(itemId, latestPrice || 0, undefined, true, itemName);
      setToast({ msg: `Quick sale logged for ${itemName} at ${(latestPrice || 0).toLocaleString()} mesos.`, visible: true });
    } catch (err) {
      setToast({ msg: `Failed to log sale: ${err instanceof Error ? err.message : String(err)}`, visible: true });
    }
    setShowSaleWarning(false);
    onClose();
  }

  function cancelSaleWarning() {
    setShowSaleWarning(false);
  }

  // --- LocalStorage persist function for addedToShopAt, character-specific and multi-item aware ---
  function persistAddedToShopAt(characterId: string, itemId: string, timestamp: string | null) {
    let stored: Record<string, Record<string, (string | null)[]>> = {};
    try {
      stored = JSON.parse(localStorage.getItem('addedToShopAtMap') || '{}');
    } catch {}
    if (!stored[characterId]) stored[characterId] = {};
    if (!stored[characterId][itemId]) stored[characterId][itemId] = [];
    // Only add if not already present (for unique timestamps)
    if (!stored[characterId][itemId].includes(timestamp)) {
      stored[characterId][itemId].push(timestamp);
    }
    localStorage.setItem('addedToShopAtMap', JSON.stringify(stored));
  }

  function handleAddToStore() {
    if (onAddToStore) {
      if (item) {
        const {
          mean, std, p0, p25, p50, p75, p100, num_outlier, sum_bundle,
          search_item_timestamp, search_results_captured
        } = item;
        if (!item.added_to_shop_at) {
          const now = new Date().toISOString();
          item.added_to_shop_at = now;
          // persist all additions, even if same itemId for different characters
          if (selectedCharacterId) {
            persistAddedToShopAt(selectedCharacterId, item.$id, now);
          }
        }
        onAddToStore(characterId, item.$id, {
          mean, std, p0, p25, p50, p75, p100, num_outlier, sum_bundle,
          search_item_timestamp: search_item_timestamp ?? undefined, search_results_captured
        });
      } else {
        onAddToStore(characterId, itemId);
      }
      return;
    }
    setToast({ msg: `${itemName} added to store.`, visible: true });
    onClose();
  }

  function handleRemoveFromStore() {
    if (onRemoveFromStore) {
      onRemoveFromStore(characterId, itemId);
      setToast({ msg: `${itemName} removed from store.`, visible: true });
      onClose();
      return;
    }
    setToast({ msg: `Item not found in store.`, visible: true });
  }

  if (!open) return null;

  const inputWidth = 480;

  return (
    <div
      className="global-modal"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0,0,0,0.54)',
        zIndex: 3001,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none', // Block pointer events on overlay
      }}
      onClick={onClose}
    >
      <div
        ref={modalRef}
        style={{
          width: 600,
          height: 300,
          background: '#232b3c',
          borderRadius: 16,
          boxShadow: '0 2px 24px #0006',
          boxSizing: 'border-box',
          padding: '18px 40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
          pointerEvents: 'auto', // Allow pointer events only on modal
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{display:'flex',alignItems:'center',gap:12,justifyContent:'center',width:'100%', marginBottom: 18}}>
          <span style={{fontSize:22,fontWeight:700,letterSpacing:0.1}}>Quick Sell / Price Change</span>
          <span style={{color:'#a88f4a',fontWeight:600,fontSize:16,background:'#2d2d2d',borderRadius:6,padding:'3px 10px'}}>{itemName}</span>
        </div>
        <div style={{width:inputWidth,display:'flex',flexDirection:'column',alignItems:'center',padding:'0 0 6px 0'}}>
          <label style={{ fontWeight: 600, fontSize: 15, marginBottom: 6, color: '#e0c080', textAlign:'center' }}>Character</label>
          <select value={characterId} onChange={e => setCharacterId(e.target.value)} style={{ width: inputWidth, fontSize: 16, padding: '10px 12px', borderRadius: 8, border: '1.5px solid #444', background: '#18191c', color: '#fff', fontWeight: 500, textAlign:'center' }}>
            {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ width:inputWidth,display:'flex',flexDirection:'column',alignItems:'center',padding:'0 0 6px 0' }}>
          <label style={{ fontWeight: 600, fontSize: 15, marginBottom: 6, color: '#e0c080', textAlign:'center' }}>Sell Price (mesos)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#232323', borderRadius: 8, padding: '2px 8px', border: '1.5px solid #444', justifyContent:'center', width: inputWidth }}>
            <span style={{ fontSize: 15, color: '#a88f4a', fontWeight: 700 }}>₩</span>
            <span style={{ fontSize: 16, color: '#fff', fontWeight: 600, minWidth: 60, textAlign: 'left' }}>
              {typeof latestPrice === 'number' ? latestPrice.toLocaleString() : <span style={{ color: '#888' }}>No price set</span>}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 8, width:inputWidth, padding:'4px 0 0 0' }}>
          <button onClick={onClose} style={{ background: 'none', border: '1.5px solid #888', color: '#fff', borderRadius: 8, padding: '8px 20px', fontSize: 15, cursor: 'pointer', fontWeight: 500, transition: 'background 0.15s, color 0.15s', margin: 0 }}>Cancel</button>
          <button
            style={{
              background: alreadyLogged24h ? '#888' : 'linear-gradient(90deg,#2d8cff,#5fcfff)',
              color: '#fff',
              fontWeight: 600,
              border: 'none',
              borderRadius: 8,
              padding: '8px 20px',
              fontSize: 15,
              cursor: alreadyLogged24h ? 'not-allowed' : 'pointer',
              opacity: alreadyLogged24h ? 0.7 : 1,
              margin: 0
            }}
            onClick={alreadyLogged24h ? undefined : handleQuickSell}
            disabled={alreadyLogged24h}
          >
            Log Quick Sell <span style={{fontSize:13,marginLeft:6,opacity:0.7}}>(Q)</span>
          </button>
          <button onClick={handleAddToStore} style={{ background: 'linear-gradient(90deg,#a87e2f,#ffd27a)', border: 'none', color: '#232323', borderRadius: 8, padding: '8px 20px', fontSize: 15, cursor: 'pointer', fontWeight: 700, boxShadow: '0 2px 8px #a87e2f22', transition: 'background 0.15s', margin: 0 }}>Add to Store</button>
          <button onClick={() => setChangePriceOpen(true)} style={{ background: 'linear-gradient(90deg,#2d8cff,#5fcfff)', border: 'none', color: '#fff', borderRadius: 8, padding: '8px 20px', fontSize: 15, cursor: 'pointer', fontWeight: 700, boxShadow: '0 2px 8px #2d8cff22', transition: 'background 0.15s', margin: 0 }}>Change Price</button>
          <button onClick={handleRemoveFromStore} style={{ background: 'none', border: '1.5px solid #e74c3c', color: '#e74c3c', borderRadius: 8, padding: '8px 14px', fontSize: 14, cursor: 'pointer', fontWeight: 700, transition: 'background 0.15s, color 0.15s', margin: 0 }}>Remove from Store</button>
        </div>
        {changePriceOpen && (
          <ChangePriceModal
            open={changePriceOpen}
            onClose={() => setChangePriceOpen(false)}
            currentPrice={latestPrice || 0}
            onSetPrice={async (newPrice: number) => {
              await handleChangePrice(itemId, newPrice, undefined, false, itemName);
              setChangePriceOpen(false);
              // Refetch after update
              const persistentUserId = localStorage.getItem('persistentUserId');
              if (persistentUserId && itemId) {
                getLatestUserPriceEntryRX(persistentUserId, itemId).then(entry => {
                  setLatestPrice(typeof entry?.price === 'number' ? entry.price : null);
                });
              }
            }}
            itemId={itemId}
          />
        )}
        {showSaleWarning && (
          <SaleWarningModal
            open={true}
            onConfirm={confirmSaleWarning}
            onCancel={cancelSaleWarning}
            itemName={itemName}
            price={latestPrice}
          />
        )}
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 18, right: 18, background: 'none', border: 'none', fontSize: 22, fontWeight: 600, color: '#aaa', cursor: 'pointer' }}
          aria-label="Close"
        >
          ×
        </button>
      </div>
    </div>
  );
}
