import React from "react";
import type { PriceHistoryEntry, Item } from "./types";

interface LedgerListProps {
  entries: PriceHistoryEntry[];
  itemMap?: Record<string, Item>;
  emptyText?: string;
}

export const LedgerList: React.FC<LedgerListProps> = ({ entries, itemMap = {}, emptyText }) => {
  if (!entries.length) {
    return <div style={{ color: '#666', fontSize: 15, padding: '18px 0', textAlign: 'center' }}>{emptyText || 'No entries found.'}</div>;
  }
  return (
    <div style={{ maxHeight: 420, overflowY: 'auto', marginTop: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15, background: 'transparent' }}>
        <thead>
          <tr style={{ background: '#21242a' }}>
            <th style={{ padding: '7px 8px', color: '#b0b9d6', fontWeight: 700, textAlign: 'left' }}>Item</th>
            <th style={{ padding: '7px 8px', color: '#b0b9d6', fontWeight: 700, textAlign: 'left' }}>Price</th>
            <th style={{ padding: '7px 8px', color: '#b0b9d6', fontWeight: 700, textAlign: 'left' }}>Date</th>
            <th style={{ padding: '7px 8px', color: '#b0b9d6', fontWeight: 700, textAlign: 'left' }}>User</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(e => {
            // DEBUG: Log entry to see what fields are present
            // console.log('LedgerList entry', e);
            // Always use item_name for display; fallback to itemMap if missing
            const displayName = e.item_name || itemMap[e.itemId]?.name || <span style={{ color: '#e74c3c' }}>Unknown Item</span>;
            return (
              <tr key={e.$id} style={{ borderBottom: '1px solid #23283a' }}>
                <td style={{ padding: '7px 8px', color: '#fff' }}>{displayName}</td>
                <td style={{ padding: '7px 8px', color: '#2d8cff', fontWeight: 600 }}>{e.price}</td>
                <td style={{ padding: '7px 8px', color: '#b0b9d6' }}>{new Date(e.date).toLocaleString()}</td>
                <td style={{ padding: '7px 8px', color: '#b0b9d6' }}>{e.author_ign || e.author}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
