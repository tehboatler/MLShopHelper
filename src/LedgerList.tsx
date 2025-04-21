import React, { useState, useRef, useEffect, useCallback } from "react";
import { useVirtualizer } from '@tanstack/react-virtual';
import { createPortal } from 'react-dom';
import type { PriceHistoryEntry, Item } from "./types";

interface LedgerListProps {
  entries: PriceHistoryEntry[];
  itemMap?: Record<string, Item>;
  emptyText?: string;
}

export const LedgerList: React.FC<LedgerListProps> = ({ entries, itemMap = {}, emptyText }) => {
  const [hovered, setHovered] = useState<string | null>(null);
  const [showReturnTop, setShowReturnTop] = useState(false);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const prevEntriesRef = useRef(entries);
  const [now, setNow] = useState<Date>(() => new Date());

  // Only show sold items
  const soldEntries = entries.filter(e => e.sold);

  // Virtualizer setup
  const rowVirtualizer = useVirtualizer({
    count: soldEntries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64, // slightly more for border
    overscan: 10,
  });

  // Calculate row height depending on sold
  const getRowHeight = (entry: PriceHistoryEntry) => 64; // Fixed height for all rows

  // Show 'Return to Top' if user is scrolled down
  useEffect(() => {
    const onScroll = () => {
      if (!parentRef.current) return;
      setShowReturnTop(parentRef.current.scrollTop > 120);
    };
    const el = parentRef.current;
    if (el) {
      el.addEventListener('scroll', onScroll);
      return () => el.removeEventListener('scroll', onScroll);
    }
  }, []);

  // When entries change, optionally scroll to top
  useEffect(() => {
    if (prevEntriesRef.current !== entries) {
      prevEntriesRef.current = entries;
      // Optionally, show 'Return to Top' button if scrolled
      setShowReturnTop((parentRef.current?.scrollTop ?? 0) > 120);
    }
  }, [entries]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 60000); // update every minute
    return () => clearInterval(interval);
  }, []);

  const handleReturnTop = useCallback(() => {
    if (parentRef.current) {
      parentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  // --- Context menu state ---
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: PriceHistoryEntry | null }>({ x: 0, y: 0, entry: null });

  // --- Right click handler ---
  const handleRowContextMenu = (e: React.MouseEvent, entry: PriceHistoryEntry) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
  };

  // --- Delete own entry logic ---
  const handleDeleteEntry = async (entry: PriceHistoryEntry) => {
    if (!entry || !entry.$id) return;
    if (!window.confirm('Delete this price history entry? This cannot be undone.')) return;
    // Optimistically remove from UI (if needed, lift state up)
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
  };

  if (!soldEntries.length) {
    return <div className="ledger-list-empty">{emptyText || 'No sold entries found.'}</div>;
  }
  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      {showReturnTop && (
        <button
          className="ledger-list-return-top-btn"
          style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}
          onClick={handleReturnTop}
        >
          Return to Top
        </button>
      )}
      <div
        ref={parentRef}
        className="ledger-list-scroll-container no-scrollbar"
        style={{ height: '100%', width: '100%', overflowY: 'auto', position: 'relative' }}
      >
        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map(virtualRow => {
            const e = soldEntries[virtualRow.index];
            // Always use a string for displayName
            const rawName = e.item_name || itemMap[e.itemId]?.name;
            const displayName = rawName ?? "Unknown Item";
            const isUnknown = !rawName;
            // Format date as compact string: 1d, 2h, 5m, 30s, now
            const dateObj = new Date(e.date);
            const diffMs = now.getTime() - dateObj.getTime();
            const diffSec = Math.floor(diffMs / 1000);
            const diffMin = Math.floor(diffSec / 60);
            const diffHours = Math.floor(diffMin / 60);
            const diffDays = Math.floor(diffHours / 24);
            let relativeDate = '';
            if (diffDays > 0) relativeDate = `${diffDays}d`;
            else if (diffHours > 0) relativeDate = `${diffHours}h`;
            else if (diffMin > 0) relativeDate = `${diffMin}m`;
            else if (diffSec > 5) relativeDate = `${diffSec}s`;
            else relativeDate = 'now';
            const isHovered = hovered === e.$id;
            // Clean, subtle green background for sold rows
            const soldRowStyle = e.sold
              ? { background: 'rgba(67,230,126,0.08)' }
              : undefined;
            // Refined hover effect: subtle blue border for all, blue background for unsold, teal for sold
            const hoverRowStyle = isHovered
              ? e.sold
                ? { outline: '2px solid #2ecf7f', background: 'rgba(67,230,126,0.16)' }
                : { outline: '2px solid #2196f3', background: 'rgba(33,150,243,0.08)' }
              : undefined;
            return (
              <div
                key={e.$id}
                className={`ledger-list-row block`}
                onMouseEnter={ev => setTooltip(null)}
                onMouseMove={ev => setTooltip({
                  x: ev.clientX + 12,
                  y: ev.clientY + 16,
                  text: displayName,
                })}
                onMouseLeave={() => setTooltip(null)}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  width: '100%',
                  boxSizing: 'border-box',
                  height: `${getRowHeight(e)}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                  padding: '0 12px',
                  margin: 0, // Remove any margin
                  ...soldRowStyle,
                  ...hoverRowStyle
                }}
                onContextMenu={ev => handleRowContextMenu(ev, e)}
              >
                <div className="ledger-list-row-block-main" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', position: 'relative'}}>
                  <span
                    className={`ledger-list-row-item-name`}
                    style={{
                      position: 'relative',
                      cursor: 'pointer',
                      fontWeight: isHovered ? 700 : 500,
                      zIndex: 2,
                      maxWidth: 180,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    tabIndex={0}
                  >
                    {isUnknown ? <span className="ledger-list-unknown-item">{displayName}</span> : displayName}
                  </span>
                  <span className="ledger-list-row-price">{e.price.toLocaleString()}</span>
                </div>
                <div className="ledger-list-row-block-meta" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%'}}>
                  <span className="ledger-list-row-author">{e.author_ign || e.author}</span>
                  <span className="ledger-list-row-date" style={{ alignSelf: 'flex-end', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>{relativeDate}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {tooltip && createPortal(
        <div
          className="ledger-list-row-item-tooltip"
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y,
            background: '#181f2e',
            color: '#fff',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 15,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 16px 0 #0009',
            pointerEvents: 'none',
            padding: '7px 16px',
            zIndex: 10010,
            opacity: 1,
            transition: 'opacity 0.13s',
            maxWidth: '90vw',
          }}
        >
          {tooltip.text}
        </div>,
        document.body
      )}
      {/* Context menu for deleting own entry */}
      {contextMenu.entry && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x, zIndex: 3000, position: 'fixed' }}
          onMouseLeave={() => setContextMenu({ ...contextMenu, entry: null })}
        >
          {contextMenu.entry.author === localStorage.getItem('persistentUserId') && (
            <button
              className="context-menu-item"
              style={{ color: '#e74c3c', fontWeight: 700 }}
              onClick={() => {
                handleDeleteEntry(contextMenu.entry!);
                setContextMenu({ ...contextMenu, entry: null });
              }}
            >
              🗑 Delete Entry
            </button>
          )}
        </div>
      )}
    </div>
  );
};
