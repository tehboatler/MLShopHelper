import { useState, useEffect, useMemo } from "react";
import { Modal } from "./Modal";
import { ChangePriceModal } from "./ChangePriceModal";
import { getRecentPriceHistory, addPriceHistoryEntryRX } from './priceHistoryRXDB';
import { getIGNForUserId } from "./api/anonLinks";
import { getPersistentAnonUsersInfoBatch } from "./api/persistentAnon";
import { updateUserKarma } from "./api/persistentAnon";
import { downvotePriceHistoryEntry } from "./api/priceHistory";
import Plot from 'react-plotly.js';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import type { PriceHistoryEntry } from "./types";

interface PriceHistoryModalProps {
  open: boolean;
  onClose: () => void;
  itemId: string;
  itemName: string;
  currentPrice: number;
  onSetPrice: (newPrice: number) => void;
}

function formatDate(date: string, format?: string): string {
  const d = new Date(date);
  if (format === 'yyyy-MM-dd') return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
  return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
}

// Helper: persistent cache for user info
function getUserInfoCache() {
  try {
    return JSON.parse(localStorage.getItem('userInfoCache') || '{}');
  } catch {
    return {};
  }
}
function setUserInfoCache(cache: Record<string, { ign?: string, karma?: number }>) {
  localStorage.setItem('userInfoCache', JSON.stringify(cache));
}

// --- batching and caching for user info ---
async function batchFetchUserInfo(userIds: string[]): Promise<Record<string, { ign?: string; karma?: number }>> {
  // Use persistent cache
  let cache = getUserInfoCache();
  const uncached = userIds.filter(id => !cache[id]);
  let results: Record<string, { ign?: string; karma?: number }> = {};
  if (uncached.length > 0) {
    // Batch fetch missing user info
    const fetched = await getPersistentAnonUsersInfoBatch(uncached);
    // Merge into cache
    cache = { ...cache, ...fetched };
    setUserInfoCache(cache);
  }
  userIds.forEach(id => {
    results[id] = cache[id] || {};
  });
  return results;
}

export function PriceHistoryModal({ open, onClose, itemId, itemName, currentPrice, onSetPrice }: PriceHistoryModalProps) {
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([]);
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [showUnsold, setShowUnsold] = useState(false);
  const [authorIGNMap, setAuthorIGNMap] = useState<Record<string, string>>({});
  const [authorKarmaMap, setAuthorKarmaMap] = useState<Record<string, number>>({});
  const [currentUserIGN, setCurrentUserIGN] = useState<string>("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [downvoteLoading, setDownvoteLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open && itemId) {
      let isMounted = true;
      // 1. Instantly load and display RXDB data
      (async () => {
        const rxdbEntries = await getRecentPriceHistory(itemId.toString());
        if (!isMounted) return;
        setPriceHistory(rxdbEntries.map(doc => ({
          $id: doc.id,
          itemId: doc.itemId,
          price: doc.price,
          date: doc.date,
          author: doc.author,
          sold: !!doc.sold,
          notes: doc.notes,
          downvotes: doc.downvotes || [],
        })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        const uniqueAuthors = Array.from(new Set(rxdbEntries.map(e => e.author)));
        const userInfo = await batchFetchUserInfo(uniqueAuthors);
        if (!isMounted) return;
        setAuthorIGNMap(Object.fromEntries(uniqueAuthors.map(id => [id, userInfo[id]?.ign || ''])));
        setAuthorKarmaMap(Object.fromEntries(uniqueAuthors.map(id => [id, userInfo[id]?.karma ?? 0])));
      })();
      // 2. In the background, sync with Appwrite and update if needed
      (async () => {
        const rxdbEntries = await getRecentPriceHistory(itemId.toString());
        let watermark: string | null = null;
        if (rxdbEntries.length > 0) {
          watermark = rxdbEntries[0].date;
        }
        let appwriteEntries = [];
        if (watermark) {
          const { Query } = await import('appwrite');
          const { databases } = await import('./lib/appwrite');
          const databaseId = import.meta.env.VITE_APPWRITE_DATABASE;
          const collectionId = import.meta.env.VITE_APPWRITE_PRICE_HISTORY_COLLECTION;
          const queries = [
            Query.equal("itemId", itemId.toString()),
            Query.greaterThan("date", watermark),
            Query.limit(1000)
          ];
          const res = await databases.listDocuments(databaseId, collectionId, queries);
          appwriteEntries = res.documents;
        } else {
          const { documents } = await import('./api/priceHistory').then(m => m.getPriceHistory(itemId.toString()));
          appwriteEntries = documents;
        }
        const rxdbIds = new Set(rxdbEntries.map(e => e.id));
        let inserted = false;
        for (const entry of appwriteEntries) {
          if (!rxdbIds.has(entry.$id)) {
            await addPriceHistoryEntryRX({
              id: entry.$id || `${entry.itemId}-${entry.date}-${entry.author}`,
              itemId: entry.itemId,
              price: entry.price,
              date: entry.date,
              author: entry.author,
              sold: !!entry.sold,
              notes: entry.notes ?? '',
            });
            inserted = true;
          }
        }
        if (inserted && isMounted) {
          const entries = await getRecentPriceHistory(itemId.toString());
          setPriceHistory(entries.map(doc => ({
            $id: doc.id,
            itemId: doc.itemId,
            price: doc.price,
            date: doc.date,
            author: doc.author,
            sold: !!doc.sold,
            notes: doc.notes,
            downvotes: doc.downvotes || [],
          })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
          const uniqueAuthors = Array.from(new Set(entries.map(e => e.author)));
          const userInfo = await batchFetchUserInfo(uniqueAuthors);
          setAuthorIGNMap(Object.fromEntries(uniqueAuthors.map(id => [id, userInfo[id]?.ign || ''])));
          setAuthorKarmaMap(Object.fromEntries(uniqueAuthors.map(id => [id, userInfo[id]?.karma ?? 0])));
        }
      })();
      return () => { isMounted = false; };
    }
  }, [open, itemId]);

  useEffect(() => {
    // Get current userId from localStorage or app state
    const uid = localStorage.getItem('persistentUserId');
    setCurrentUserId(uid);
    if (uid) {
      getIGNForUserId(uid).then(ign => setCurrentUserIGN(ign || ""));
    }
  }, [open]);

  // Memoize filteredHistory to avoid unnecessary recalculations and render loops
  const filteredHistory = useMemo(() => (
    showUnsold ? priceHistory : priceHistory.filter(e => e.sold)
  ), [showUnsold, priceHistory]);

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
        const ign = authorIGNMap[entry.author];
        // console.log('[PriceHistoryModal] Rendering author cell:', { entry, ign, authorIGNMap });
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
  ], [authorIGNMap, authorKarmaMap, downvotedIds, downvoteLoading, currentUserId, columnHelper]);

  // Do NOT wrap useReactTable in useMemo! This is a hook and must be called at the top level.
  const table = useReactTable({
    data: filteredHistory,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {},
  });

  // --- Boxplot data aggregation ---
  function getBoxplotStats(prices: number[]) {
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

  // Group by date (YYYY-MM-DD)
  const boxplotData = Object.values(
    filteredHistory.reduce((acc, entry) => {
      const d = formatDate(entry.date);
      if (!acc[d]) acc[d] = { date: d, prices: [] };
      acc[d].prices.push(entry.price);
      return acc;
    }, {} as Record<string, { date: string; prices: number[] }>)
  ).map(({ date, prices }) => ({ date, ...getBoxplotStats(prices) }));

  // console.log('boxplotData', boxplotData);

  // Pad boxplotData if only one day, to force Recharts to render axes
  const paddedBoxplotData = boxplotData.length === 1
    ? [
        { ...boxplotData[0] },
        { ...boxplotData[0], date: boxplotData[0].date + ' (dummy)', min: null, max: null, p25: null, p50: null, p75: null, avg: null }
      ]
    : boxplotData;

  return (
    <>
      <Modal open={open} onClose={onClose} disableEsc={changeModalOpen}>
        <div style={{
          width: '110vw', // wider
          maxWidth: '100%',
          height: '98vh', // taller
          maxHeight: '100%',
          minWidth: 900,
          minHeight: 600,
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          padding: 0
        }}>
          {/* Main Content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, padding: 0 }}>
            <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:12, paddingRight:0, position:'relative', paddingTop: 8}}>
              <button
                onClick={onClose}
                aria-label="Back"
                style={{ background: 'none', border: 'none', fontSize: 28, color: '#2d8cff', cursor: 'pointer', padding: 0, marginRight: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <span style={{fontWeight:900, fontSize: 32, lineHeight: 1}}>&lt;</span>
              </button>
              <h2 style={{margin:'0', flex:1}}>{itemName} Price History</h2>
              <button
                onClick={() => setShowUnsold(v => !v)}
                style={{ background: showUnsold ? '#2d8cff' : '#eee', color: showUnsold ? '#fff' : '#222', border: 'none', borderRadius: 8, padding: '6px 14px', fontWeight: 500, cursor: 'pointer', fontSize: 14 }}
              >
                {showUnsold ? 'Hide Unsold' : 'Show Unsold'}
              </button>
            </div>
            <div style={{marginBottom:12, display:'flex', alignItems:'center', gap:16}}>
              <b>Current Price:</b> <span>{currentPrice.toLocaleString()}</span>
            </div>
            {priceHistory.length > 0 ? (
              <div style={{ flex: '0 0 320px', minHeight: 320, width: '100%' }}>
                {/* --- Plotly Boxplot (responsive, dark mode) --- */}
                <Plot
                  data={[
                    // Box traces for each day
                    ...paddedBoxplotData.map(d => ({
                      type: 'box',
                      y: filteredHistory.filter(e => formatDate(e.date) === d.date).map(e => e.price),
                      name: d.date,
                      boxpoints: 'outliers',
                      marker: { color: '#2d8cff' },
                      line: { color: '#2d8cff' },
                      fillcolor: 'rgba(45,140,255,0.15)',
                      boxmean: 'sd',
                      showlegend: false,
                    })),
                    // Scatter overlay for all points
                    {
                      type: 'scatter',
                      y: filteredHistory.map(e => e.price),
                      x: filteredHistory.map(e => formatDate(e.date, 'yyyy-MM-dd')),
                      mode: 'markers',
                      marker: { color: '#f55', size: 10, opacity: 0.7 },
                      name: 'Sales',
                      showlegend: false,
                    }
                  ]}
                  layout={{
                    autosize: true,
                    margin: { l: 60, r: 16, t: 20, b: 60 },
                    boxmode: 'group',
                    yaxis: {
                      title: 'Price',
                      zeroline: false,
                      gridcolor: '#222b',
                      color: '#e8e8e8',
                    },
                    xaxis: {
                      title: 'Date',
                      tickangle: -35,
                      tickformat: '%Y-%m-%d',
                      color: '#e8e8e8',
                      tickfont: { color: '#e8e8e8', size: 13 },
                    },
                    plot_bgcolor: '#181c24',
                    paper_bgcolor: '#181c24',
                    font: { family: 'inherit', size: 13, color: '#e8e8e8' },
                    hoverlabel: { bgcolor: '#222', color: '#fff', font: { size: 13 } },
                  }}
                  config={{ displayModeBar: false, responsive: true }}
                  useResizeHandler={true}
                  style={{ width: '100%', height: '320px' }}
                />
              </div>
            ) : (
              <div style={{ color: '#888', margin: '24px 0', textAlign: 'center' }}>
                No sales history to display.
              </div>
            )}
            {priceHistory.length > 0 && paddedBoxplotData.length === 1 && (
              <div style={{ color: '#888', textAlign: 'center', marginBottom: 8 }}>
                Only one day of price data. Add more sales to see trends over time.
              </div>
            )}
            <div style={{ flex: 1, minHeight:0, overflowY:'auto', display:'flex', flexDirection:'column', marginTop: 8, width: '100%' }}>
              <div style={{flex:1, minHeight:0, width: '100%'}}>
                <table className="styled-table" style={{ width: '100%' }}>
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
                    {table.getRowModel().rows.map(row => {
                      const isSold = row.original.sold;
                      return (
                        <tr key={row.id}
                          style={isSold
                            ? { background: 'linear-gradient(90deg, #233c23 0%, #1e2e1e 100%)', color: '#c6ffd0' }
                            : { background: 'inherit', color: 'inherit' }
                          }
                        >
                          {row.getVisibleCells().map(cell => (
                            <td key={cell.id} style={{ textAlign: cell.column.id === 'date' ? 'left' : cell.column.id === 'price' ? 'right' : cell.column.id === 'author' ? 'left' : 'center' }}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <button onClick={() => {
              setChangeModalOpen(true); // open modal instantly
              if (currentUserId) {
                getIGNForUserId(currentUserId).then(ign => setCurrentUserIGN(ign || ""));
              }
            }} style={{marginTop:16}}>Change Current Sale Price</button>
            <ChangePriceModal
              open={changeModalOpen}
              onClose={() => setChangeModalOpen(false)}
              currentPrice={currentPrice}
              onSetPrice={async newPrice => {
                // Add new price history entry to RXDB
                if (typeof itemId !== 'undefined' && itemId && currentUserId) {
                  await addPriceHistoryEntryRX({
                    id: `${itemId}-${Date.now()}`,
                    itemId,
                    price: newPrice,
                    date: new Date().toISOString(),
                    author: currentUserId,
                    sold: false,
                    notes: '',
                  });
                  // Refresh price history from RXDB
                  const entries = await getRecentPriceHistory(itemId.toString());
                  setPriceHistory(entries.map(doc => ({
                    $id: doc.id,
                    itemId: doc.itemId,
                    price: doc.price,
                    date: doc.date,
                    author: doc.author,
                    sold: !!doc.sold,
                    notes: doc.notes,
                    downvotes: doc.downvotes || [],
                  })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())); // Most recent first
                  const uniqueAuthors = Array.from(new Set(entries.map(e => e.author)));
                  const userInfo = await batchFetchUserInfo(uniqueAuthors);
                  setAuthorIGNMap(Object.fromEntries(uniqueAuthors.map(id => [id, userInfo[id]?.ign || ''])));
                  setAuthorKarmaMap(Object.fromEntries(uniqueAuthors.map(id => [id, userInfo[id]?.karma ?? 0])));
                }
                if (typeof onSetPrice === 'function') onSetPrice(newPrice);
                setChangeModalOpen(false);
              }}
              itemId={itemId}
              title={`Change Price for ${itemName}`}
              itemName={itemName}
            />
          </div>
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
