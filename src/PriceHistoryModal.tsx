import { useState, useEffect, useMemo, useRef } from "react";
import { Modal } from "./Modal";
import { ChangePriceModal } from "./ChangePriceModal";
// import { getPriceHistory, syncPriceHistoryToRxdb, addPriceHistoryEntry } from './api/priceHistory';
// import { getRecentPriceHistory } from './priceHistoryRXDB';
import { getIGNForUserId } from "./api/anonLinks";
// import { getPersistentAnonUsersInfoBatch } from "./api/persistentAnon";
// import { updateUserKarma } from "./api/persistentAnon";
import { downvotePriceHistoryEntry } from "./api/priceHistory";
import Plot from 'react-plotly.js';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import type { PriceHistoryEntry, ItemStats } from "./types";
import { getDb, replicatePriceHistorySandbox } from './rxdb';
// import { useRxdbItems } from './hooks/useRxdbItems';

interface PriceHistoryModalProps {
  open: boolean;
  onClose: () => void;
  itemId: string;
  itemName: string;
  currentPrice: number;
  filterByFriends?: boolean;
  friendsWhitelist?: string[];
  onSetPrice: (newPrice: number) => void;
  itemStats: ItemStats;
}

function formatDate(date: string, format?: string): string {
  const d = new Date(date);
  if (format === 'yyyy-MM-dd') {
    return `${d.getUTCFullYear()}-${(d.getUTCMonth()+1).toString().padStart(2,'0')}-${d.getUTCDate().toString().padStart(2,'0')}`;
  }
  return `${d.getUTCFullYear()}-${(d.getUTCMonth()+1).toString().padStart(2,'0')}-${d.getUTCDate().toString().padStart(2,'0')}`;
}

// // Helper: persistent cache for user info
// function getUserInfoCache() {
//   try {
//     return JSON.parse(localStorage.getItem('userInfoCache') || '{}');
//   } catch {
//     return {};
//   }
// }
// function setUserInfoCache(cache: Record<string, { ign?: string, karma?: number }>) {
//   localStorage.setItem('userInfoCache', JSON.stringify(cache));
// }

// --- batching and caching for user info ---
// async function batchFetchUserInfo(userIds: string[]): Promise<Record<string, { ign?: string; karma?: number }>> {
//   // Use persistent cache
//   let cache = getUserInfoCache();
//   const uncached = userIds.filter(id => !cache[id]);
//   let results: Record<string, { ign?: string; karma?: number }> = {};
//   if (uncached.length > 0) {
//     // Batch fetch missing user info
//     const fetched = await getPersistentAnonUsersInfoBatch(uncached);
//     // Merge into cache
//     cache = { ...cache, ...fetched };
//     setUserInfoCache(cache);
//   }
//   userIds.forEach(id => {
//     results[id] = cache[id] || {};
//   });
//   return results;
// }

export function PriceHistoryModal({ open, onClose, itemId, itemName, currentPrice, filterByFriends, friendsWhitelist, onSetPrice, itemStats }: PriceHistoryModalProps) {
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([]);
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [showUnsold, setShowUnsold] = useState(false);
  const [authorIGNMap, _] = useState<Record<string, string>>({});
  const [authorKarmaMap, setAuthorKarmaMap] = useState<Record<string, number>>({});
  const [__, setCurrentUserIGN] = useState<string>("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [downvoteLoading, setDownvoteLoading] = useState<Record<string, boolean>>({});
  const [___, setLoading] = useState(false);
  const replicationRef = useRef<any>(null);

  useEffect(() => {
    let isCancelled = false;
    let sub: any;
    let replicationState: any;
    async function setupLiveReplication() {
      setLoading(true);
      const db = await getDb();
      // Start/refresh live replication for this item
      if (replicationRef.current) {
        replicationRef.current.cancel();
      }
      replicationState = await replicatePriceHistorySandbox(db);
      // --- Replication event logging for debugging ---
      if (replicationState) {
        replicationState.error$?.subscribe((err: any) => console.error('Replication error:', err));
        replicationState.active$?.subscribe((active: boolean) => console.log('Replication active:', active));
        replicationState.received$?.subscribe((doc: any) => console.log('Replication received doc:', doc));
      }
      replicationRef.current = replicationState;
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
          setPriceHistory(docs.map(doc => ({
            $id: doc.id || doc.$id,
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
    if (open) {
      setupLiveReplication();
    }
    return () => {
      isCancelled = true;
      if (sub) sub.unsubscribe();
      if (replicationRef.current) {
        replicationRef.current.cancel();
        replicationRef.current = null;
      }
    };
  }, [open, itemId]);

  useEffect(() => {
    // Get current userId from localStorage or app state
    const uid = localStorage.getItem('persistentUserId');
    setCurrentUserId(uid);
    if (uid) {
      getIGNForUserId(uid).then(ign => setCurrentUserIGN(ign || ""));
    }
  }, [open]);

  // Apply friends filtering to price history entries if enabled
  const filteredPriceHistory = useMemo(() => {
    if (filterByFriends && currentUserId) {
      return priceHistory.filter(entry => entry.author === currentUserId);
    }
    return priceHistory;
  }, [filterByFriends, currentUserId, priceHistory]);

  // Debug output for filtering - remove in production
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[PriceHistoryModal DEBUG]', {
        currentUserId,
        friendsWhitelist,
        allAuthors: priceHistory.map(e => e.author),
        filteredAuthors: filteredPriceHistory.map(e => e.author),
        filterByFriends
      });
    }
  }, [currentUserId, friendsWhitelist, priceHistory, filteredPriceHistory, filterByFriends]);

  // Memoize filteredHistory to avoid unnecessary recalculations and render loops
  const filteredHistory = useMemo(() => (
    showUnsold ? filteredPriceHistory : filteredPriceHistory.filter(e => e.sold)
  ), [showUnsold, filteredPriceHistory]);

  // Memoize downvotedIds to avoid unnecessary recalculations
  const downvotedIds = useMemo(() => {
    if (!currentUserId || !filteredHistory.length) return new Set<string>();
    return new Set(
      filteredHistory.filter(e => Array.isArray(e.downvotes) && e.downvotes.includes(currentUserId)).map(e => e.$id)
    );
  }, [filteredHistory, currentUserId]);

  // Memoize columns to avoid recreation on every render
  const columnHelper = useMemo(() => createColumnHelper<PriceHistoryEntry>(), []);
  const columns = useMemo(() => [
    columnHelper.accessor('date', {
      header: () => <span style={{ textAlign: 'left', display: 'block', width: '100%' }}>Date</span>,
      cell: info => <span style={{ textAlign: 'left', display: 'block', width: '100%' }}>{formatDate(info.getValue())}</span>,
    }),
    columnHelper.accessor('price', {
      header: () => <span style={{ textAlign: 'right', display: 'block', width: '100%' }}>Price</span>,
      cell: info => <span style={{ textAlign: 'right', display: 'block', width: '100%' }}>{info.getValue().toLocaleString()}</span>,
    }),
    columnHelper.display({
      id: 'author',
      header: () => <span style={{ textAlign: 'left', display: 'block', width: '100%' }}>User</span>,
      cell: info => {
        const entry = info.row.original;
        const ign = entry.author_ign || authorIGNMap[entry.author];
        return (
          <span>
            {ign ? (
              <span>
                <span style={{ fontWeight: 600 }}>{ign}</span>
                <span style={{ color: '#aaa', fontSize: 12, marginLeft: 6 }}>({entry.author})</span>
              </span>
            ) : (
              <span style={{ color: '#aaa' }}>{entry.author}</span>
            )}
          </span>
        );
      },
    }),
    columnHelper.display({
      id: 'downvote',
      header: () => <span style={{ textAlign: 'center', display: 'block', width: '100%' }}>Downvote</span>,
      cell: info => {
        const entry = info.row.original;
        return (
          <div style={{ textAlign: 'center', width: '100%' }}>
            <button
              style={{
                fontSize: 11,
                color: downvotedIds.has(entry.$id) ? '#aaa' : '#ff4444',
                background: 'none',
                border: `1px solid ${downvotedIds.has(entry.$id) ? '#aaa' : '#ff4444'}`,
                borderRadius: 4,
                padding: '1px 6px',
                cursor: downvoteLoading[entry.$id] || downvotedIds.has(entry.$id) || !entry.sold ? 'not-allowed' : 'pointer',
                opacity: downvoteLoading[entry.$id] || downvotedIds.has(entry.$id) || !entry.sold ? 0.5 : 1,
                minWidth: 68,
              }}
              disabled={downvoteLoading[entry.$id] || downvotedIds.has(entry.$id) || !entry.sold}
              title={
                !entry.sold ? 'Only sold entries can be downvoted' :
                downvotedIds.has(entry.$id) ? 'You have already downvoted this entry' : 'Downvote for inaccuracy'
              }
              onClick={async (e) => {
                e.preventDefault();
                if (downvotedIds.has(entry.$id) || !entry.sold) return;
                setDownvoteLoading(l => ({ ...l, [entry.$id]: true }));
                try {
                  await downvotePriceHistoryEntry(entry.$id, currentUserId!);
                  setAuthorKarmaMap(m => ({
                    ...m,
                    [entry.author]: (m[entry.author] ?? 0) - 1
                  }));
                } catch (err) {
                  if (err && typeof err === 'object' && 'message' in err) {
                    alert('Failed to downvote: ' + (err as any).message);
                  } else {
                    alert('Failed to downvote: ' + String(err));
                  }
                } finally {
                  setDownvoteLoading(l => ({ ...l, [entry.$id]: false }));
                }
              }}
            >
              ↓ Downvote
            </button>
          </div>
        );
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <span style={{ textAlign: 'center', display: 'block', width: '100%' }}>Actions</span>,
      cell: info => {
        const entry = info.row.original;
        if (!currentUserId || entry.author !== currentUserId) return null;
        return (
          <button
            className="table-action"
            style={{ color: '#e74c3c', fontWeight: 700, fontSize: 16, background: 'none', border: 'none', cursor: 'pointer' }}
            title="Delete this entry"
            onClick={async (e) => {
              e.preventDefault();
              if (window.confirm('Delete this price history entry? This cannot be undone.')) {
                // Optimistically update UI
                setPriceHistory(ph => ph.filter(p => p.$id !== entry.$id));
                // Delete from RXDB
                try {
                  const { deletePriceHistoryEntryRX } = await import('./priceHistoryRXDB');
                  await deletePriceHistoryEntryRX(entry.$id);
                } catch (err) {
                  if (err && typeof err === 'object' && 'message' in err) {
                    alert('Failed to delete entry: ' + (err as any).message);
                  } else {
                    alert('Failed to delete entry: ' + String(err));
                  }
                }
              }
            }}
          >🗑</button>
        );
      }
    })
  ], [authorIGNMap, authorKarmaMap, downvotedIds, downvoteLoading, currentUserId, columnHelper]);

  // Do NOT wrap useReactTable in useMemo! This is a hook and must be called at the top level.
  const table = useReactTable({
    data: filteredHistory,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {},
  });

  // --- Utility: Filter outliers using IQR method ---
  function filterOutliers(prices: number[]): number[] {
    if (prices.length < 4) return prices;
    const sorted = [...prices].sort((a, b) => a - b);
    const q1 = percentile(sorted, 0.25);
    const q3 = percentile(sorted, 0.75);
    const iqr = q3 - q1;
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;
    return sorted.filter(p => p >= lower && p <= upper);
  }

  // --- Helper: percentile ---
  function percentile(sorted: number[], p: number): number {
    const idx = (sorted.length - 1) * p;
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
  }

  // --- Boxplot data aggregation ---
  function getBoxplotStats(prices: number[]): { min: number; max: number; p25: number; p50: number; p75: number; avg: number } {
    if (!prices.length) return { min: 0, max: 0, p25: 0, p50: 0, p75: 0, avg: 0 };
    const sorted = [...prices].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const p = (q: number) => {
      const pos = (sorted.length - 1) * q;
      const base = Math.floor(pos);
      const rest = pos - base;
      if (sorted[base + 1] !== undefined) return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
      return sorted[base];
    };
    const p25 = p(0.25);
    const p50 = p(0.5);
    const p75 = p(0.75);
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    return { min, max, p25, p50, p75, avg };
  }

  // Group by date (YYYY-MM-DD), filter outliers for each day
  const boxplotData = Object.values(
    filteredHistory.reduce((acc, entry) => {
      const d = formatDate(entry.date);
      if (!acc[d]) acc[d] = { date: d, prices: [] };
      acc[d].prices.push(entry.price);
      return acc;
    }, {} as Record<string, { date: string; prices: number[] }>)
  ).map(({ date, prices }) => {
    const filtered = filterOutliers(prices);
    return { date, ...getBoxplotStats(filtered), filteredPrices: filtered };
  });

  // Pad boxplotData if only one day, to force Recharts to render axes
  const paddedBoxplotData = boxplotData.length === 1
    ? [
        { ...boxplotData[0] },
        { ...boxplotData[0], date: boxplotData[0].date + ' (dummy)', min: null, max: null, p25: null, p50: null, p75: null, avg: null }
      ]
    : boxplotData;

  // --- Market stats for item ---
  const itemBoxplotData = useMemo(() => {
    if (!itemStats) return undefined;
    return {
      y: [
        itemStats.p0,
        itemStats.p25,
        itemStats.p50,
        itemStats.p75,
        itemStats.p100
      ],
      mean: itemStats.mean,
      std: itemStats.std,
      name: 'Current Market (Stats)',
      updatedAt: itemStats.search_item_timestamp,
    };
  }, [itemStats]);

  // --- Compute y-axis range for both plots (shared scale) ---
  const yMin = useMemo(() => {
    const historyMin = paddedBoxplotData.flat().reduce((min, d) => Math.min(min, d.min ?? Infinity), Infinity);
    const itemMin = itemBoxplotData ? Math.min(...itemBoxplotData.y.filter((v): v is number => v !== undefined)) : Infinity;
    return Math.min(historyMin, itemMin);
  }, [paddedBoxplotData, itemBoxplotData]);
  const yMax = useMemo(() => {
    const historyMax = paddedBoxplotData.flat().reduce((max, d) => Math.max(max, d.max ?? -Infinity), -Infinity);
    const itemMax = itemBoxplotData ? Math.max(...itemBoxplotData.y.filter((v): v is number => v !== undefined)) : -Infinity;
    return Math.max(historyMax, itemMax);
  }, [paddedBoxplotData, itemBoxplotData]);

  return (
    <>
      <Modal open={open} onClose={onClose} disableEsc={changeModalOpen}>
        {/* Modal Content Wrapper: force flex: 1 so children can fill modal-content */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#e8e8e8', marginBottom: 4 }}>{itemName}</div>
          {/* Plots Row: fixed height, always visible */}
          <div style={{ display: 'flex', flexDirection: 'row', gap: 12, width: '100%', alignItems: 'flex-start', height: 320 }}>
            {/* --- Existing Price History Boxplot --- */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'visible' }}>
              <Plot
                data={[
                  // Box traces for each day (filtered)
                  ...paddedBoxplotData.map(d => ({
                    type: 'box',
                    y: d.filteredPrices,
                    name: d.date,
                    boxpoints: 'outliers',
                    marker: { color: '#2d8cff' },
                    line: { color: '#2d8cff' },
                    fillcolor: 'rgba(45,140,255,0.15)',
                    boxmean: 'sd',
                    showlegend: false,
                  })),
                  // Scatter overlay for all points
                ]}
                layout={{
                  title: '',
                  margin: { l: 48, r: 32, t: 18, b: 38 },
                  yaxis: {
                    title: 'Price',
                    tickfont: { color: '#e8e8e8', size: 13 },
                    gridcolor: '#333',
                    zeroline: false,
                    color: '#e8e8e8',
                    range: [yMin, yMax],
                  },
                  plot_bgcolor: '#181c24',
                  paper_bgcolor: '#181c24',
                  font: { family: 'inherit', size: 13, color: '#e8e8e8' },
                  hoverlabel: { bgcolor: '#222', color: '#fff', font: { size: 13 } },
                }}
                config={{ displayModeBar: false, responsive: true }}
                useResizeHandler={true}
                style={{ width: '100%', height: '320px', overflow: 'visible' }}
              />
            </div>
            {/* --- New: Appwrite Item Market Stats Boxplot --- */}
            {itemBoxplotData && (
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'stretch', flexShrink: 0 }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', position: 'relative' }}>
                  <Plot
                    data={[{
                      y: itemBoxplotData.y,
                      type: 'box',
                      boxpoints: false,
                      name: 'Market Stats',
                      marker: { color: '#2d8cff' },
                      line: { color: '#2d8cff' },
                      boxmean: false,
                      hoverinfo: 'y',
                      customdata: [
                        `Mean: ${itemBoxplotData.mean ?? 'N/A'}`,
                        `Std: ${itemBoxplotData.std ?? 'N/A'}`
                      ],
                      hovertemplate: 'Percentile: %{y}<br>%{customdata[0]}<br>%{customdata[1]}<extra></extra>'
                    }]}
                    layout={{
                      title: '',
                      margin: { l: 10, r: 10, t: 18, b: 38 },
                      yaxis: {
                        title: '',
                        tickfont: { color: '#e8e8e8', size: 11 },
                        gridcolor: '#333',
                        zeroline: false,
                        color: '#e8e8e8',
                        range: [yMin, yMax],
                        showticklabels: false,
                      },
                      xaxis: { visible: false },
                      plot_bgcolor: '#181c24',
                      paper_bgcolor: '#181c24',
                      font: { family: 'inherit', size: 12, color: '#e8e8e8' },
                      hoverlabel: { bgcolor: '#222', color: '#fff', font: { size: 12 } },
                    }}
                    config={{ displayModeBar: false, responsive: true }}
                    useResizeHandler={true}
                    style={{ width: '100%', height: '320px' }}
                  />
                  {/* Attribution inside the plot container, at the bottom */}
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: '100%',
                    background: 'rgba(24,28,36,0.85)',
                    color: '#aaa',
                    fontSize: 11,
                    textAlign: 'center',
                    padding: '4px 2px 2px 2px',
                    borderBottomLeftRadius: 8,
                    borderBottomRightRadius: 8,
                    zIndex: 2
                  }}>
                    <span style={{ color: '#7ecfff' }}>
                      Powered by <a href="https://github.com/geospiza/owlrepo" target="_blank" style={{ color: '#7ecfff', textDecoration: 'underline' }}>@geospiza owlrepo API</a>
                    </span>
                    {itemBoxplotData?.updatedAt && (
                      <span style={{ color: '#aeefff', fontSize: 10, marginLeft: 8 }}>
                        Data as of {new Date(itemBoxplotData.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* Section bar for show/hide unsold */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              background: 'rgba(36,40,54,0.96)',
              borderRadius: 12,
              boxShadow: '0 2px 12px 0 rgba(45,140,255,0.04)',
              border: '1.5px solid rgba(220,225,255,0.10)',
              padding: '12px 18px',
              margin: '5px 0 5px 0',
              minHeight: 0,
            }}
          >
            <button
              type="button"
              onClick={() => setShowUnsold(v => !v)}
              style={{
                background: showUnsold
                  ? 'linear-gradient(90deg, #2d8cff 0%, #5b7fff 100%)'
                  : 'rgba(120,130,160,0.13)',
                color: showUnsold ? '#fff' : '#c1c7d6',
                border: 'none',
                borderRadius: 10,
                fontWeight: 600,
                fontSize: 15,
                padding: '8px 22px',
                cursor: 'pointer',
                boxShadow: showUnsold ? '0 2px 12px 0 rgba(45,140,255,0.08)' : undefined,
                transition: 'background 0.15s, color 0.15s',
                outline: showUnsold ? '2px solid #2d8cff' : 'none',
              }}
            >
              {showUnsold ? 'Hide Unsold' : 'Show Unsold'}
            </button>
          </div>
          {/* Table section fills remaining space */}
          <div style={{ flex: 1, minHeight:0, overflowY:'auto', display:'flex', flexDirection:'column', marginTop: 0, width: '100%' }}>
            <div style={{flex:1, minHeight:0, width: '100%', background: 'linear-gradient(180deg, #23283a 70%, #232b3c 100%)', borderRadius: 8, display: 'flex', flexDirection: 'column', justifyContent: 'stretch'}}>
              <table className="styled-table" style={{ width: '100%', minHeight: '100%', background: 'transparent', borderRadius: 8, borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  {table.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map(header => (
                        <th key={header.id}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.length === 0 ? (
                    <tr>
                      <td colSpan={table.getAllLeafColumns().length} style={{ background: 'none', height: '180px', textAlign: 'center', color: '#888', fontSize: 15, borderBottom: '1.5px solid #2d8cff', borderRadius: '0 0 8px 8px' }}>
                        No price history found.
                      </td>
                    </tr>
                  ) : (
                    table.getRowModel().rows.map(row => {
                      const isSold = row.original.sold;
                      return (
                        <tr key={row.id}
                          style={isSold
                            ? { background: 'linear-gradient(90deg, #233c23 0%, #1e2e1e 100%)', color: '#c6ffd0' }
                            : { background: 'linear-gradient(90deg, #181c24 0%, #23283a 100%)', color: '#e8e8e8' }
                          }
                        >
                          {row.getVisibleCells().map(cell => (
                            <td key={cell.id} style={{ textAlign: cell.column.id === 'date' ? 'left' : cell.column.id === 'price' ? 'right' : cell.column.id === 'author' ? 'left' : 'center', borderBottom: '1px solid #232b3c' }}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <ChangePriceModal
            open={changeModalOpen}
            onClose={() => setChangeModalOpen(false)}
            currentPrice={currentPrice}
            onSetPrice={onSetPrice}
            itemId={itemId}
            title={`Change Price for ${itemName}`}
            item_name={itemName}
          />
        </div>
      </Modal>
    </>
  );
}

// Add the following CSS to App.css or a relevant CSS file:
// .styled-table {
//   width: 100%;
//   border-collapse: collapse;
//   background: #232323;
//   border-radius: 12px;
//   overflow: hidden;
// }
// .styled-table th, .styled-table td {
//   padding: 12px 18px;
//   text-align: left;
// }
// .styled-table th {
//   background: #181818;
//   font-size: 1.1rem;
//   font-weight: 600;
// }
// .styled-table tr {
//   border-bottom: 1px solid #333;
// }
