import React, { useMemo } from "react";
import { Item, PriceHistoryEntry } from "./types";
import { daysAgo } from "./utils";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';

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
}

const columnHelper = createColumnHelper<Item>();

export default function InventoryTable({
  filteredItems,
  search,
  setSearch,
  setModalOpen,
  tableContainerRef,
  tableScrollTop,
  sortKey,
  sortAsc,
  handleSort,
  itemMap,
  selectedCharacter,
  userPriceMap,
  priceStats,
  handleInventoryContextMenu,
  highlightedRow,
  handleOpenStockDialog,
  setSellItem,
  setSellModalOpen,
  openHistoryModal,
}: InventoryTableProps) {
  // Fix priceStats typing for indexed access
  const getRecentPrice = (itemId: string) => priceStats[itemId]?.recent;

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
      cell: info => userPriceMap.get(info.row.original.$id)?.price?.toLocaleString() ?? <span style={{color:'#888'}}>No price set</span>,
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
        const median = priceStats[info.row.original.$id]?.p50;
        return median !== undefined ? median.toLocaleString() : <span style={{color:'#888'}}>–</span>;
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
    data: filteredItems,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualSorting: true, // sorting handled externally
    state: {
      sorting: [{ id: sortKey, desc: !sortAsc }],
    },
  });

  // For type-safe percentile/avg keys
  const statKeys = ['p25', 'p50', 'p75', 'avg'] as const;
  type StatKey = typeof statKeys[number];

  // Limit visible items to 7 for performance, unless searching
  const visibleRows = search.trim().length > 0
    ? table.getRowModel().rows
    : table.getRowModel().rows.slice(0, 7);

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
                  onContextMenu={e => handleInventoryContextMenu(e, row.original.$id)}
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
                        fontSize: '5px',
                        color: '#333',
                        padding: '0.5px 8px 0.5px 8px',
                        borderRadius: 0,
                        minHeight: 0,
                        background: 'inherit',
                      }}
                    >
                      {statKeys.map((key: StatKey) => (
                        <div key={key} style={{ flex: 1, textAlign: 'left', padding: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start' }}>
                          <span style={{
                            fontWeight: 500,
                            color: key === 'avg' ? '#2d8cff' : '#888888',
                            letterSpacing: 0,
                            fontSize: '12px',
                            whiteSpace: 'nowrap',
                          }}>
                            {key.toUpperCase()}: <span style={{color: '#b0b4bb'}}>{priceStats[row.original.$id]?.[key]?.toLocaleString() ?? '-'}</span>
                          </span>
                        </div>
                      ))}
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
    </div>
  );
}
