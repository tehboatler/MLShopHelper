import { useState, useEffect } from "react";
import { Modal } from "./Modal";
import { ChangePriceModal } from "./ChangePriceModal";
import { invoke } from "@tauri-apps/api/core";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export interface PriceEntry {
  id?: number;
  item_id?: number;
  price: number;
  date: string;
  author: string;
  sold: boolean;
}

interface PriceHistoryModalProps {
  open: boolean;
  onClose: () => void;
  itemId: number;
  itemName: string;
  currentPrice: number;
  onSetPrice: (newPrice: number) => void;
}

function formatRelativeDate(dateString: string): string {
  const now = new Date("2025-04-19T15:08:45+10:00"); // Use the provided absolute current time
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

function formatDate(date: string) {
  const d = new Date(date);
  return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
}

export function PriceHistoryModal({ open, onClose, itemId, itemName, currentPrice, onSetPrice }: PriceHistoryModalProps) {
  const [priceHistory, setPriceHistory] = useState<PriceEntry[]>([]);
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [showUnsold, setShowUnsold] = useState(false);

  useEffect(() => {
    if (open) {
      invoke("get_price_history", { itemId }).then((value) => {
        const data = value as PriceEntry[];
        setPriceHistory(data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
      });
    }
  }, [open, itemId]);

  const filteredHistory = showUnsold ? priceHistory : priceHistory.filter(e => e.sold);
  // Show up to 50 most recent entries for the chart, oldest first
  const chartData = priceHistory.slice(-50).map(e => ({
    ...e,
    date: formatDate(e.date),
    status: e.sold ? 'Sold' : 'Unsold',
  }));

  return (
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
            <div style={{ flex: '0 0 240px', minHeight: 120, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" minTickGap={20} angle={-25} textAnchor="end" fontSize={12} />
                  <YAxis dataKey="price" fontSize={12} width={60} />
                  <Tooltip formatter={(value: number, name: string, props: any) => value.toLocaleString()} labelFormatter={v => `Date: ${v}`}/>
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#2d8cff"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                    name="Sold"
                    data={chartData.filter(e => e.sold)}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#f55"
                    strokeDasharray="4 2"
                    strokeWidth={2}
                    dot={{ r: 4, stroke: '#f55', fill: '#fff' }}
                    isAnimationActive={false}
                    name="Unsold"
                    data={chartData.filter(e => !e.sold)}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ color: '#888', margin: '24px 0', textAlign: 'center' }}>
              No sales history to display.
            </div>
          )}
          <div style={{ flex: 1, minHeight:0, overflowY:'auto', display:'flex', flexDirection:'column', marginTop: 8, width: '100%' }}>
            <table className="styled-table" style={{flex:1, minHeight:0, width: '100%'}}>
              <thead>
                <tr>
                  <th>Price</th>
                  <th>Date</th>
                  <th>Author</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((entry, i) => (
                  <tr key={i} className={entry.sold ? "sold-row" : "unsold-row"}>
                    <td>{entry.price.toLocaleString()}</td>
                    <td>{formatRelativeDate(entry.date)}</td>
                    <td>{entry.author}</td>
                    <td>{entry.sold ? <span style={{color:'#4caf50',fontWeight:600}}>Sold</span> : <span style={{color:'#bbb'}}>Unsold</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={() => setChangeModalOpen(true)} style={{marginTop:16}}>Change Current Sale Price</button>
          <ChangePriceModal
            open={changeModalOpen}
            onClose={() => setChangeModalOpen(false)}
            currentPrice={currentPrice}
            onSetPrice={price => {
              setChangeModalOpen(false);
              setPriceHistory([]); // force reload
              onSetPrice(price); // propagate up so App can refresh items
            }}
            itemId={itemId}
            author={localStorage.getItem('ign') || 'Unknown'}
            title="Change Current Sale Price"
            itemName={itemName}
          />
        </div>
      </div>
    </Modal>
  );
}
