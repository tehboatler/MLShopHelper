import React, { useMemo, useEffect, useState } from "react";
import { Item, PriceHistoryEntry } from "./types";
import { daysAgo } from "./utils";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { getDb, updateAllItemStats } from './rxdb';
import { MainItemTableContextMenu } from './MainItemTableContextMenu';
import { deleteItem } from './api/items';

interface InventoryTableProps {
  filteredItems: Item[];
  search: string;
  setSearch: (v: string) => void;
  setModalOpen: (v: boolean) => void;
  tableContainerRef: React.RefObject<HTMLDivElement>;
  tableScrollTop: number;
  sortKey: string;
  sortAsc: boolean;
  handleSort: (col: 'name' | 'current_selling_price' | 'last_sold') => void;
  itemMap: Record<string, Item>;
  selectedCharacter: any;
  userPriceMap: Map<string, any>;
  priceStats: Record<string, {
    recent?: PriceHistoryEntry;
    p25?: number;
    p50?: number;
    p75?: number;
    avg?: number;
  }>;
  handleInventoryContextMenu: (e: React.MouseEvent, itemId: string) => void;
  highlightedRow: string | null;
  handleOpenStockDialog: (itemId: string) => void;
  setSellItem: (item: Item) => void;
  setSellModalOpen: (open: boolean) => void;
  openHistoryModal: (item: Item) => void;
  filterByFriends?: boolean;
  friendsWhitelist?: string[];
}

const columnHelper = createColumnHelper<Item>();

export default function InventoryTable({
  filteredItems,
  search,
  setSearch,
  setModalOpen,
  tableContainerRef,
  // tableScrollTop,
  sortKey,
  sortAsc,
  handleSort,
  // itemMap,
  // selectedCharacter,
  userPriceMap,
  priceStats,
  handleInventoryContextMenu,
  // highlightedRow,
  handleOpenStockDialog,
  setSellItem,
  setSellModalOpen,
  openHistoryModal,
  // filterByFriends,
  // friendsWhitelist
}: InventoryTableProps) {
  // Defensive: filter out undefined items into a local variable
  const validItems = useMemo(() => {
    // Debug: log the incoming filteredItems for inspection
    console.log('[InventoryTable] filteredItems received:', filteredItems);
    // Only accept $id (not id) now that normalization is guaranteed
    const result = filteredItems.filter(i => i && typeof i.$id === 'string' && i.$id.length > 0 && typeof i.name === 'string' && i.name.length > 0);
    console.log('[InventoryTable] validItems after $id filter:', result);
    return result;
  }, [filteredItems]);

  // Fix priceStats typing for indexed access
  const getRecentPrice = (itemId: string) => priceStats[itemId]?.recent;

  // Fetch itemStats from RxDB using direct query (no rxdb-hooks)
  const [itemStats, setItemStats] = useState<any[]>([]);
  useEffect(() => {
    let mounted = true;
    getDb().then(db =>
      db.itemStats.find().exec().then(stats => {
        if (mounted) setItemStats(stats);
      })
    );
    return () => { mounted = false; };
  }, []);

  // Update itemStats on UI refresh (mount)
  useEffect(() => {
    updateAllItemStats().then(() => {
      // Optionally re-fetch itemStats after update
      getDb().then(db =>
        db.itemStats.find().exec().then(stats => {
          setItemStats(stats);
        })
      );
    });
  }, []);

  // Memoize stats lookup by itemId
  const statsMap = useMemo(
    () => new Map((itemStats ?? []).map(stat => [stat.itemId, stat.toJSON ? stat.toJSON() : stat])),
    [itemStats]
  );

  // Debug: log statsMap and a sample stats entry for the first row
  useEffect(() => {
    console.log('[InventoryTable] userPriceMap:', userPriceMap);
    console.log('[InventoryTable] statsMap:', statsMap);
    if (validItems.length > 0) {
      const id = validItems[0].$id;
      const stats = statsMap.get(id);
      console.log('[InventoryTable] Sample stats for first item:', stats);
    }
  }, [userPriceMap, statsMap, validItems]);

  // Debug: log the mapping between filteredItems and statsMap keys
  useEffect(() => {
    const itemIds = validItems.map(i => i.$id);
    const statsKeys = Array.from(statsMap.keys());
    console.log('[InventoryTable] validItems IDs:', itemIds);
    console.log('[InventoryTable] statsMap keys:', statsKeys);
    const missing = itemIds.filter(id => id && !statsMap.has(id));
    console.log('[InventoryTable] Item IDs missing in statsMap:', missing);
  }, [validItems, statsMap]);

  // Define columns using TanStack Table
  const columns = useMemo(() => [
    columnHelper.display({
      id: 'stock',
      header: () => 'Stock',
      cell: info => (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); handleOpenStockDialog(info.row.original.$id); }}
          style={{
            background: 'linear-gradient(90deg, #d7a14d 0%, #e7c873 50%, #a86e2f 100%)',
            border: 'none',
            color: '#3a2a14',
            fontWeight: 700,
            borderRadius: 4,
            padding: '4px 12px',
            cursor: 'pointer',
            fontSize: 14,
            boxShadow: '0 2px 6px #0001',
            transition: 'background 0.18s, color 0.18s',
          }}
        >Stock</button>
      ),
      size: 80,
    }),
    columnHelper.accessor('name', {
      header: () => (
        <span style={{ cursor: 'pointer' }} onClick={() => handleSort('name')}>
          Name {sortKey === 'name' ? (sortAsc ? '▲' : '▼') : ''}
        </span>
      ),
      cell: info => info.getValue(),
      size: 200,
    }),
    columnHelper.display({
      id: 'current_selling_price',
      header: () => (
        <span style={{ cursor: 'pointer' }} onClick={() => handleSort('current_selling_price')}>
          Your Price {sortKey === 'current_selling_price' ? (sortAsc ? '▲' : '▼') : ''}
        </span>
      ),
      cell: info => {
        const entry = userPriceMap.get(info.row.original.$id);
        return entry && typeof entry.price === 'number'
          ? entry.price.toLocaleString()
          : <span style={{color:'#888'}}>No price set</span>;
      },
      size: 120,
    }),
    columnHelper.display({
      id: 'median_price',
      header: () => (
        <span style={{ cursor: 'pointer' }}>
          Median Price
        </span>
      ),
      cell: info => {
        const stats = statsMap.get(info.row.original.$id);
        const median = stats?.median;
        return median !== undefined && median !== null
          ? median.toLocaleString(undefined, { maximumFractionDigits: 0 })
          : <span style={{color:'#888'}}>–</span>;
      },
      size: 120,
    }),
    columnHelper.display({
      id: 'last_sold',
      header: () => (
        <span style={{ cursor: 'pointer' }} onClick={() => handleSort('last_sold')}>
          Last Sold {sortKey === 'last_sold' ? (sortAsc ? '▲' : '▼') : ''}
        </span>
      ),
      cell: info => daysAgo(getRecentPrice(info.row.original.$id)?.date),
      size: 120,
    }),
    columnHelper.display({
      id: 'actions',
      header: () => '',
      cell: info => (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', width: '100%' }}>
          <button
            style={{ background: '#4caf50', color: '#888888', fontWeight: 600, border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}
            onClick={e => { e.stopPropagation(); setSellItem(info.row.original); setSellModalOpen(true); }}
            aria-label="Sell"
          >
            <img src="/placeholder-sell.png" alt="Sell" style={{ width: 24, height: 24, objectFit: 'contain' }} />
          </button>
        </div>
      ),
      size: 80,
    }),
  ], [handleOpenStockDialog, handleSort, priceStats, setSellItem, setSellModalOpen, sortAsc, sortKey, userPriceMap]);

  const table = useReactTable({
    data: validItems,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualSorting: true, // sorting handled externally
    state: {
      sorting: [{ id: sortKey, desc: !sortAsc }],
    },
  });

  // For type-safe percentile/avg keys
  // const statKeys = ['p25', 'p50', 'p75', 'avg'] as const;
  // type StatKey = typeof statKeys[number];

  // Limit visible items to 7 for performance, unless searching
  const visibleRows = search.trim().length > 0
    ? table.getRowModel().rows
    : table.getRowModel().rows.slice(0, 7);

  // Context menu state for main item table
  const [contextMenu, setContextMenu] = useState<{ open: boolean; x: number; y: number; itemId: string | null }>({ open: false, x: 0, y: 0, itemId: null });

  // Refresh items function (calls parent fetch if available)
  const refreshItems = () => {
    if (typeof window !== 'undefined' && window.location) {
      window.location.reload(); // fallback, or trigger parent fetch if available
    }
  };

  // Handler for right click/context menu
  const handleMainTableContextMenu = (e: React.MouseEvent, itemId: string) => {
    e.preventDefault();
    setContextMenu({ open: true, x: e.clientX, y: e.clientY, itemId });
  };

  // Delete handler for main table
  const handleDelete = async () => {
    if (!contextMenu.itemId) return;
    try {
      await deleteItem(contextMenu.itemId);
      refreshItems();
    } catch (err) {
      alert('Failed to delete item: ' + (err?.toString() || err));
    }
  };

  return (
    <div style={{ flex: 1, minWidth: 0, paddingLeft: 14 }}>
      <div className="search-row">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items..."
          className="row search-input"
        />
        <button className="add-btn" onClick={() => setModalOpen(true)}>Add Item</button>
      </div>
      <div
        className="table-responsive sticky-table"
        ref={tableContainerRef}
        style={{
          maxHeight: 'calc(100vh - 170px)',
          height: '100%',
          overflowY: 'auto',
          overflowX: 'auto',
          position: 'relative',
          background: 'transparent',
        }}
      >
        <table className="styled-table sticky-table" style={{ width: '100%', tableLayout: 'fixed' }}>
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th key={header.id} style={{ width: header.getSize() }}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {visibleRows.map((row, i) => (
              <React.Fragment key={row.id}>
                <tr
                  key={row.id}
                  onClick={e => {
                    if (
                      e.target instanceof HTMLElement &&
                      (e.target.tagName === 'BUTTON' ||
                        e.target.tagName === 'A' ||
                        e.target.tagName === 'INPUT' ||
                        e.target.closest('button, a, input'))
                    ) {
                      return;
                    }
                    openHistoryModal(row.original);
                  }}
                  onContextMenu={e => handleMainTableContextMenu(e, row.original.$id)}
                  style={{
                    cursor: 'pointer',
                    background: i % 2 === 1 ? '#292929' : "#202020",
                    transition: 'background 0.3s',
                  }}
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      ...(cell.column.id === 'actions' ? {textAlign: 'right'} : {}),
                    }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                {/* Sub-section for percentiles and avg price */}
                <tr>
                  <td colSpan={columns.length} style={{ padding: 0, background: i % 2 === 1 ? '#292929' : "#202020", borderTop: 'none' }}>
                    <div
                      className="compact subrow-bar"
                      style={{
                        width: '66%',
                        margin: '0',
                        display: 'flex',
                        justifyContent: 'flex-start',
                        alignItems: 'flex-start',
                        fontSize: '11px',
                        color: '#bbb',
                        padding: '2px 8px',
                        borderRadius: 0,
                        minHeight: 0,
                      }}
                    >
                      {(() => {
                        const stats = statsMap.get(row.original.$id);
                        const format = (n: number | null | undefined) =>
                          typeof n === 'number' ? n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-';
                        return (
                          <>
                            <span style={{ marginRight: 12 }}>P25: {format(stats?.p25)}</span>
                            <span style={{ marginRight: 12 }}>Median: {format(stats?.median)}</span>
                            <span style={{ marginRight: 12 }}>Avg: {format(stats?.avg)}</span>
                            <span>P75: {format(stats?.p75)}</span>
                          </>
                        );
                      })()}
                    </div>
                  </td>
                </tr>
              </React.Fragment>
            ))}
            {/* Spacer row for extra bottom space */}
            <tr>
              <td colSpan={columns.length} style={{ height: 160, border: 'none', background: 'transparent', pointerEvents: 'none' }} />
            </tr>
          </tbody>
        </table>
      </div>
      {/* Main item table context menu */}
      {contextMenu.open && (
        <MainItemTableContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu({ ...contextMenu, open: false })}
          onPriceHistory={() => openHistoryModal(validItems.find(i => i.$id === contextMenu.itemId)!)}
          onChangePrice={() => setModalOpen(true)}
          onDelete={handleDelete}
          deleteLabel="Delete from database"
        />
      )}
    </div>
  );
}
