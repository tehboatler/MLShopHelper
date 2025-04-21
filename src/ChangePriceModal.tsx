import React, { useState, useContext, useEffect, useMemo } from "react";
import { Modal } from "./Modal";
import { UISettingsContext } from "./contexts/UISettingsContext";
// import { getPriceHistory, addPriceHistoryEntry, syncPriceHistoryToRxdb } from "./api/priceHistory";
// import { getPersistentAnonUserById } from "./api/persistentAnon";
import type { PriceHistoryEntry } from "./types";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';

interface ChangePriceModalProps {
  open: boolean;
  onClose: () => void;
  currentPrice: number;
  onSetPrice: (newPrice: number) => void;
  itemId: string;
  title?: string;
  item_name?: string;
  preloadedPriceHistory?: PriceHistoryEntry[];
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

// // --- Utility: Appwrite-compliant ID generator ---
// function makeAppwriteId(itemId: string, userId: string) {
//   const safeDate = new Date().toISOString().replace(/[^a-zA-Z0-9]/g, '').slice(0, 14);
//   return `${itemId.slice(0, 12)}-${safeDate}-${userId.slice(0, 8)}`.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 36);
// }

export function ChangePriceModal({ open, onClose, currentPrice, onSetPrice, itemId, preloadedPriceHistory }: ChangePriceModalProps) {
  const uiSettings = useContext(UISettingsContext);
  const round50k = uiSettings?.round50k ?? false;
  const showUnsold = uiSettings?.showUnsold ?? false;
  const setRound50k = uiSettings?.setRound50k;
  const setShowUnsold = uiSettings?.setShowUnsold;

  const [customPrice, setCustomPrice] = useState("");
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState("");
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>(preloadedPriceHistory || []);
  const [sortBy, setSortBy] = useState<'date'|'price'>('date');
  const [sortDir, setSortDir] = useState<'desc'|'asc'>('desc');
  const [selectedHistoryIdx, setSelectedHistoryIdx] = useState<number|null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setError("");
  }, [customPrice, percent]);

  useEffect(() => {
    if (open) {
      // console.log("[ChangePriceModal DEBUG] useEffect open:", open, "itemId:", itemId);
    }
  }, [open, itemId]);

  useEffect(() => {
    // console.log("[ChangePriceModal DEBUG] priceHistory updated:", priceHistory);
  }, [priceHistory]);

  useEffect(() => {
    // console.log("[ChangePriceModal DEBUG] showUnsold updated:", showUnsold);
  }, [showUnsold]);

  useEffect(() => {
    if (!open || !itemId) return;
    let isCancelled = false;
    let sub: any;
    let replicationState: any;
    async function setupLiveReplication() {
      setLoading(true);
      const db = await import('./rxdb').then(m => m.getDb());
      // Start/refresh live replication for all price history
      if (replicationState && replicationState.cancel) {
        replicationState.cancel();
      }
      replicationState = await import('./rxdb').then(m => m.replicatePriceHistorySandbox(db));
      // --- Replication event logging for debugging ---
      if (replicationState) {
        replicationState.error$?.subscribe((err: any) => console.error('Replication error:', err));
        replicationState.active$?.subscribe((active: boolean) => console.log('Replication active:', active));
        replicationState.received$?.subscribe((doc: any) => console.log('Replication received doc:', doc));
      }
      // Subscribe to RXDB query for this item
      const query = db.priceHistory.find({
        selector: {
          itemId: itemId.toString(),
          date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() }
        },
        sort: [{ date: 'desc' }],
      });
      sub = query.$.subscribe((docs: any[]) => {
        if (!isCancelled) {
          setPriceHistory(docs.map((doc: any) => ({
            $id: doc.$id,
            itemId: doc.itemId,
            price: doc.price,
            date: doc.date,
            author: doc.author,
            author_ign: doc.author_ign !== undefined ? doc.author_ign : doc.author,
            notes: doc.notes,
            sold: !!doc.sold,
            downvotes: doc.downvotes || [],
            item_name: doc.item_name || undefined,
          })));
        }
      });
      setLoading(false);
    }
    setupLiveReplication();
    return () => {
      isCancelled = true;
      if (sub) sub.unsubscribe();
      if (replicationState && replicationState.cancel) replicationState.cancel();
    };
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

  const columnHelper = createColumnHelper<PriceHistoryEntry>();
  const columns = [
    columnHelper.display({
      id: 'select',
      header: '',
      cell: info => (
        <input
          type="radio"
          name="historyPick"
          checked={selectedHistoryIdx === info.row.index}
          onChange={() => {
            setSelectedHistoryIdx(info.row.index);
            setCustomPrice(info.row.original.price.toString());
          }}
        />
      ),
      size: 36,
      minSize: 36,
      maxSize: 36,
    }),
    columnHelper.accessor('price', {
      header: () => (
        <span style={{ cursor: 'pointer' }} onClick={() => handleSort('price')}>
          Price {sortBy === 'price' ? (sortDir === 'desc' ? '▼' : '▲') : ''}
        </span>
      ),
      cell: info => (
        <span
          style={{ cursor: 'pointer' }}
          onClick={() => {
            setSelectedHistoryIdx(info.row.index);
            setCustomPrice(info.row.original.price.toString());
          }}
        >
          {info.getValue().toLocaleString()}
        </span>
      ),
      size: 90,
      minSize: 60,
    }),
    columnHelper.accessor('date', {
      header: () => (
        <span style={{ cursor: 'pointer' }} onClick={() => handleSort('date')}>
          Date {sortBy === 'date' ? (sortDir === 'desc' ? '▼' : '▲') : ''}
        </span>
      ),
      cell: info => formatRelativeDate(info.getValue()),
      size: 120,
      minSize: 80,
    }),
    columnHelper.accessor('author', {
      header: 'Author',
      cell: info => info.getValue(),
      size: 100,
      minSize: 60,
    }),
    columnHelper.accessor('sold', {
      header: 'Status',
      cell: info => info.getValue() ? (
        <span style={{ color: '#4caf50', fontWeight: 600 }}>Sold</span>
      ) : (
        <span style={{ color: '#bbb' }}>Unsold</span>
      ),
      size: 70,
      minSize: 60,
    }),
  ];

  // Memoize expensive filtering and sorting
  const filteredRows = useMemo(
    () => showUnsold ? priceHistory : priceHistory.filter(e => e.sold),
    [showUnsold, priceHistory]
  );

  const sortedRows = useMemo(
    () => [...filteredRows].sort((a: PriceHistoryEntry, b: PriceHistoryEntry) => {
      if (sortBy === 'date') {
        const da = new Date(a.date).getTime();
        const db = new Date(b.date).getTime();
        return sortDir === 'desc' ? db - da : da - db;
      } else {
        return sortDir === 'desc' ? b.price - a.price : a.price - b.price;
      }
    }),
    [filteredRows, sortBy, sortDir]
  );

  const table = useReactTable({
    data: sortedRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualSorting: true,
    state: {},
  });

  const parentRef = React.useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 6,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

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
    console.log('[ChangePriceModal] handleApply called:', {
      customPrice,
      percent,
      manualVal,
      percentVal,
      hasManual,
      hasPercent,
      currentPrice,
      round50k
    });
    if (hasManual) {
      newPrice = manualVal;
    } else if (hasPercent) {
      newPrice = Math.round(currentPrice * (1 + percentVal / 100));
      if (round50k) {
        newPrice = Math.round(newPrice / 50000) * 50000;
      }
    }
    setLoading(true);
    setError("");
    try {
      // Only call the parent onSetPrice handler, do NOT add to DB here
      onSetPrice(newPrice);
      setCustomPrice("");
      setPercent(0);
      setLoading(false);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to set price.");
      setLoading(false);
      console.error('[ChangePriceModal] Error during handleApply:', err);
    }
  }

  // function handleCustomPriceChange(e: React.ChangeEvent<HTMLInputElement>) {
  //   setCustomPrice(e.target.value);
  //   if (e.target.value) setPercent(0);
  // }

  function handlePercentChange(val: number) {
    setPercent(val);
    setCustomPrice("");
  }

  // console.log("[ChangePriceModal RENDER] priceHistory:", priceHistory, "showUnsold:", showUnsold, "sorted:", sortedRows, "sortBy:", sortBy, "sortDir:", sortDir);

  // DEBUG: Log data before render
  // console.log('[DEBUG] sortedRows:', sortedRows);
  // console.log('[DEBUG] virtualRows:', virtualRows);
  // console.log('[DEBUG] headerGroups:', table.getHeaderGroups());

  return (
    <Modal open={open} onClose={onClose} width={undefined} title="Change Price" noPadding alignTopLeft>
      {/* Modal content wrapper: fill all space, flex column */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, flex: 1 }}>
        {/* Main column: fill all space, flex column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
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
                <input type="number" value={customPrice} onChange={e => setCustomPrice(e.target.value)} placeholder="Manual input" style={{width: '100%', fontSize:'0.95rem', padding:'6px 8px', height:38, boxSizing:'border-box'}} />
              </label>
              <label style={{display:'flex',flexDirection:'column',gap:6,flex:'1 1 120px',width:'100%'}}>
                <span style={{color:'#e0e0e0',fontWeight:500,fontSize:'0.95rem'}}>Or adjust by %</span>
                <div style={{display:'flex',alignItems:'center',gap:6,flex:'1 1 auto',width:'100%',height:38}}>
                  <input type="number" value={percent} onChange={e => handlePercentChange(Number(e.target.value))} placeholder="e.g. 10 for +10%" style={{width:70,fontSize:'0.95rem',padding:'6px 8px',height:38,boxSizing:'border-box'}} />
                  <div style={{display:'flex',gap:6,flex:1}}>
                    <button type="button" onClick={()=>handlePercentChange(percent+1)} style={{flex:1,padding:'0 10px',fontSize:'0.95rem',height:38,background:'#2d8cff',color:'#fff',border:'none',borderRadius:4,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>+1%</button>
                    <button type="button" onClick={()=>handlePercentChange(percent-1)} style={{flex:1,padding:'0 10px',fontSize:'0.95rem',height:38,background:'#2d8cff',color:'#fff',border:'none',borderRadius:4,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>−1%</button>
                  </div>
                </div>
              </label>
            </div>
            {error && <div style={{color:'#f55',marginTop:4,fontSize:'0.95rem'}}>{error}</div>}
          </div>
          {/* Table container: fills available space, scrolls if needed */}
          <div ref={parentRef} style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            background: '#232b3c',
            borderRadius: 10,
            border: 'none'
          }}>
            <table className="styled-table" style={{
              fontSize: '0.95rem',
              lineHeight: 1.18,
              width: '100%',
              borderCollapse: 'collapse',
              tableLayout: 'fixed',
              background: 'transparent',
              color: '#fff'
            }}>
              <thead style={{ background: '#1a2233', color: '#fff', fontWeight: 700 }}>
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th key={header.id} style={{ width: header.getSize(), color: '#fff', borderBottom: '2px solid #334466', padding: '8px 4px', textAlign: 'left', background: 'inherit' }}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {virtualRows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} style={{ textAlign: 'center', color: '#aaa', padding: '18px 0' }}>
                      No price history to display.
                    </td>
                  </tr>
                ) : (
                  <tr style={{ height: virtualRows[0]?.start ?? 0 }} />
                )}
                {virtualRows.map(virtualRow => {
                  const row = table.getRowModel().rows[virtualRow.index];
                  return (
                    <tr
                      key={row.id}
                      className={row.original.sold ? "sold-row" : "unsold-row"}
                      style={{
                        background: selectedHistoryIdx === virtualRow.index ? '#2d8cff44' : (virtualRow.index % 2 === 0 ? '#232b3c' : '#1a2233'),
                        color: '#fff',
                        height: virtualRow.size
                      }}
                    >
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} style={{ color: '#fff', padding: '7px 4px', borderBottom: '1px solid #2a3450', background: 'inherit' }}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                      ))}
                    </tr>
                  );
                })}
                {/* Spacer for end of list */}
                <tr style={{ height: totalSize - (virtualRows[virtualRows.length - 1]?.end ?? 0) }} />
              </tbody>
            </table>
          </div>
          {/* Actions always at the bottom */}
          <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', padding: '0', background: 'inherit' }}>
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
              <button className="price-actions" style={{ fontSize: '0.97rem', padding: '7px 16px' }} onClick={handleApply} disabled={loading}>
                {loading ? 'Applying...' : 'Apply'}
              </button>
              <button className="price-actions" style={{ fontSize: '0.97rem', padding: '7px 16px', background: '#444', color: '#eee' }} onClick={onClose}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
