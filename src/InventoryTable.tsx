import React, { useMemo, useEffect, useState, useRef } from "react";
import { Item, PriceHistoryEntry } from "./types";
import { daysAgo } from "./utils";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table';
import {  updateAllItemStats } from './rxdb';
import { useRxdbPriceHistory } from './hooks/useRxdbPriceHistory';
import { useRxdbItemStats } from './hooks/useRxdbItemStats';
import { useVirtualizer } from '@tanstack/react-virtual';
// import { fuzzyIncludes } from "./ItemNameAutocomplete";
import Fuse from 'fuse.js';
import { useCurrentUser } from "./hooks/useCurrentUser";
import { Spinner } from "./components/Spinner";

interface InventoryTableProps {
  filteredItems: Item[];
  search: string;
  setSearch: (v: string) => void;
  setModalOpen: (v: boolean) => void;
  tableContainerRef: React.RefObject<HTMLDivElement>;
  tableScrollTop: number;
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
  loading?: boolean;
}

const columnHelper = createColumnHelper<Item>();

// Custom hook for itemStats with loading state
// function useRxdbItemStats() {
//   const [itemStats, setItemStats] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);
//   useEffect(() => {
//     let sub: any;
//     getDb().then(db => {
//       sub = db.itemStats.find().$.subscribe(stats => {
//         setItemStats(stats);
//         setLoading(false);
//       });
//     });
//     return () => sub && sub.unsubscribe();
//   }, []);
//   return [itemStats, loading] as const;
// }

export default function InventoryTable({
  filteredItems,
  search,
  setSearch,
  setModalOpen,
  tableContainerRef,
  userPriceMap,
  priceStats,
  // handleInventoryContextMenu,
  handleOpenStockDialog,
  // setSellItem,
  // setSellModalOpen,
  openHistoryModal,
  // filterByFriends,
  // friendsWhitelist
  loading = false,
}: InventoryTableProps) {
  console.log('[InventoryTable] loading:', loading);
  if (loading) {
    return (
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 240 }}>
        <Spinner size={48} />
      </div>
    );
  }

  const { hasLabel } = useCurrentUser();
  const isAdmin = hasLabel('admin');

  // --- Abbreviation and synonym expansion for search queries ---
  function expandSearchQuery(query: string) {
    const equipMap: Record<string, string> = {
      "eye acc": "Eye Accessory",
      "eye": "Eye Accessory",
      "face acc": "Face Accessory",
      "face": "Face Accessory",
      "pet": "Pet Equip.",
      "top": "Topwear",
      "bottom": "Bottomwear",
      "bot": "Bottomwear",
      "overall": "Overall",
      "helm": "Helmet",
      "glove": "Gloves",
      "gloves": "Gloves",
      "gun": "Gun",
      "cape": "Cape",
      "claw": "Claw",
      "staff": "Staff",
      "wand": "Wand",
      "knuckle": "Knuckle",
      "shoes": "Shoes",
      "shield": "Shield",
      "ear": "Earring",
      "earring": "Earring",
      "sword": "Sword",
      "one-handed": "One Handed Sword",
      "one handed": "One Handed Sword",
      "two-handed": "Two Handed Sword",
      "two handed": "Two Handed Sword",
      "1h sword": "One Handed Sword",
      "2h sword": "Two Handed Sword",
      "1h axe": "One Handed Axe",
      "2h axe": "Two Handed Axe",
      "dex": "DEX",
      "str": "STR",
      "int": "INT",
      "luk": "LUK",
      "atk": "ATT",
      "att": "ATT",
      "matk": "Magic ATT",
      "ma": "Magic ATT",
      "mag": "Magic",
      "wa": "ATT",
      "oa": "Overall",
      "1h": "One Handed",
      "2h": "Two Handed",
      "gfa": "Gloves for ATT",
      "gfma": "Gloves for Magic ATT",
      "cfa": "Claw for ATT",
      "bwg": "Brown Work Gloves",
      "acc": "Accuracy",
      "avoid": "Avoidability",
      "hp": "HP",
      "mp": "MP",
      "def": "DEF",
      "mdef": "Magic DEF",
      "30": "30%",
      "60": "60%",
      "70": "70%",
      "100": "100%",
      // Add more as needed
    };
    return query
      .split(/\s+/)
      .map(word => equipMap[word.toLowerCase()] || word)
      .join(' ');
  }

  const fuse = useMemo(() => new Fuse(filteredItems, {
    keys: ['name'],
    threshold: 0.2,           // More forgiving for typos, but still relevant
    ignoreLocation: true,     // Allow substring matches anywhere
    minMatchCharLength: 2,    // Only match if at least 2 chars
    includeScore: true,       // Attach score to each result
    findAllMatches: true,     // Return all matches
    shouldSort: true,         // Sort by best match
    useExtendedSearch: true  // Disable extended syntax for more natural behavior
  }), [filteredItems]);

  const validItems = useMemo(() => {
    if (search && search.trim().length > 0) {
      const expandedSearch = expandSearchQuery(search);
      return fuse.search(expandedSearch).map(r => r.item);
    }
    return filteredItems;
  }, [search, filteredItems, fuse]);

  // Fetch itemStats from RxDB using observable for real-time updates
  const [priceHistory, priceHistoryLoading] = useRxdbPriceHistory();
  const [itemStats, itemStatsLoading] = useRxdbItemStats();

  // Only update itemStats when both items and priceHistory are loaded and non-empty
  useEffect(() => {
    if (!priceHistoryLoading && validItems.length > 0 && priceHistory.length > 0) {
      updateAllItemStats();
    }
  }, [validItems, priceHistory, priceHistoryLoading]);

  // Compute most recent sold entry reactively from live priceHistory
  const lastSoldMap = useMemo(() => {
    const map = new Map<string, PriceHistoryEntry>();
    for (const entry of priceHistory) {
      if (entry.sold) {
        if (!map.has(entry.itemId) || new Date(entry.date) > new Date(map.get(entry.itemId)!.date)) {
          map.set(entry.itemId, entry);
        }
      }
    }
    return map;
  }, [priceHistory]);
  const getRecentPrice = (itemId: string) => lastSoldMap.get(itemId) ?? undefined;

  // Memoize stats lookup by itemId (should use the same key as item $id)
  const statsMap = useMemo(
    () => new Map((itemStats ?? []).map(stat => [stat.itemId || stat.$id, stat.toJSON ? stat.toJSON() : stat])),
    [itemStats]
  );

  // Add debug logging to InventoryTable props and key variables
  useEffect(() => {
    console.debug('[InventoryTable] filteredItems received:', filteredItems);
    if (filteredItems && filteredItems.length > 0) {
      console.debug('[InventoryTable] validItems after $id filter:', filteredItems);
      console.debug('[InventoryTable] validItems IDs:', filteredItems.map(i => i.$id));
    }
    if (userPriceMap) {
      console.debug('[InventoryTable] userPriceMap:', userPriceMap, 'keys:', Array.from(userPriceMap.keys()));
    }
    if (statsMap) {
      console.debug('[InventoryTable] statsMap:', statsMap, 'keys:', Array.from(statsMap.keys()));
    }
    if (filteredItems && filteredItems.length > 0 && statsMap) {
      const missingStats = filteredItems.filter(item => !statsMap.has(item.$id)).map(item => item.$id);
      console.debug('[InventoryTable] Item IDs missing in statsMap:', missingStats);
      if (filteredItems[0] && statsMap.has(filteredItems[0].$id)) {
        console.debug('[InventoryTable] Sample stats for first item:', statsMap.get(filteredItems[0].$id));
      }
    }
  }, [filteredItems, userPriceMap, statsMap]);

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

  // --- Sorting state for TanStack Table ---
  const [sorting, setSorting] = useState<SortingState>([]);

  // Define columns using TanStack Table
  const columns = useMemo(() => [
    // Stock button column (always left-most)
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
      enableSorting: false, // No sorting for stock button
    }),
    // Name column (second, takes at least 50% of table width)
    columnHelper.accessor('name', {
      header: ({ column }) => (
        <span
          style={{ cursor: 'pointer', userSelect: 'none', width: '50%', minWidth: '50%', display: 'inline-block' }}
          onClick={column.getToggleSortingHandler()}
        >
          Name {column.getIsSorted() === 'asc' ? '▲' : column.getIsSorted() === 'desc' ? '▼' : ''}
        </span>
      ),
      enableSorting: true,
      cell: info => {
        const item = info.row.original;
        const isOwlRepo = !!item.search_item_timestamp;
        return (
          <span style={{ width: '100%', minWidth: '50%', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {info.getValue()}
            {isOwlRepo && (
              <span style={{
                marginLeft: 8,
                background: '#2e3a4c',
                color: '#e0d36e',
                borderRadius: 4,
                padding: '2px 6px',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 0.5,
                verticalAlign: 'middle',
              }}>
                owlrepo
              </span>
            )}
          </span>
        );
      },
      size: undefined, // Let flex grow handle width
      minSize: undefined,
      maxSize: undefined,
      meta: { style: { width: '50%', minWidth: '50%' } },
    }),
    // Your Price column (sortable)
    columnHelper.accessor(row => {
      const entry = userPriceMap.get(row.$id);
      return entry && typeof entry.price === 'number' ? entry.price : null;
    }, {
      id: 'current_selling_price',
      header: ({ column }) => (
        <span
          style={{ cursor: 'pointer', userSelect: 'none' }}
          onClick={column.getToggleSortingHandler()}
        >
          Your Price {column.getIsSorted() === 'asc' ? '▲' : column.getIsSorted() === 'desc' ? '▼' : ''}
        </span>
      ),
      enableSorting: true,
      cell: info => {
        const entry = userPriceMap.get(info.row.original.$id);
        return entry && typeof entry.price === 'number'
          ? entry.price.toLocaleString()
          : <span style={{color:'#888'}}>No price set</span>;
      },
      size: 120,
      sortingFn: (a, b) => {
        const aVal = userPriceMap.get(a.original.$id)?.price;
        const bVal = userPriceMap.get(b.original.$id)?.price;
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return -1;
        if (bVal == null) return 1;
        return aVal - bVal;
      },
    }),
    // Median Price column (sortable)
    columnHelper.accessor(row => {
      const stats = statsMap.get(row.$id);
      return stats?.median ?? null;
    }, {
      id: 'median_price',
      header: ({ column }) => (
        <span
          style={{ cursor: 'pointer', userSelect: 'none' }}
          onClick={column.getToggleSortingHandler()}
        >
          Median {column.getIsSorted() === 'asc' ? '▲' : column.getIsSorted() === 'desc' ? '▼' : ''}
        </span>
      ),
      enableSorting: true,
      cell: info => {
        const stats = statsMap.get(info.row.original.$id);
        const median = stats?.median;
        return median !== undefined && median !== null
          ? median.toLocaleString(undefined, { maximumFractionDigits: 0 })
          : <span style={{color:'#888'}}>–</span>;
      },
      size: 120,
      sortingFn: (a, b) => {
        const aVal = statsMap.get(a.original.$id)?.median;
        const bVal = statsMap.get(b.original.$id)?.median;
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return -1;
        if (bVal == null) return 1;
        return aVal - bVal;
      },
    }),
    // Last Sold column (sortable)
    columnHelper.accessor(row => {
      const recent = getRecentPrice(row.$id);
      return recent?.date ?? null;
    }, {
      id: 'last_sold',
      header: ({ column }) => (
        <span
          style={{ cursor: 'pointer', userSelect: 'none' }}
          onClick={column.getToggleSortingHandler()}
        >
          Last Sold {column.getIsSorted() === 'asc' ? '▲' : column.getIsSorted() === 'desc' ? '▼' : ''}
        </span>
      ),
      enableSorting: true,
      cell: info => daysAgo(getRecentPrice(info.row.original.$id)?.date),
      size: 120,
      sortingFn: (a, b) => {
        const aDate = getRecentPrice(a.original.$id)?.date;
        const bDate = getRecentPrice(b.original.$id)?.date;
        if (!aDate && !bDate) return 0;
        if (!aDate) return -1;
        if (!bDate) return 1;
        return new Date(aDate).getTime() - new Date(bDate).getTime();
      },
    }),
  ], [handleOpenStockDialog, priceStats, userPriceMap, statsMap, getRecentPrice]);

  const table = useReactTable({
    data: validItems,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualSorting: false, // sorting handled internally
  });

  // --- Virtualizer setup for infinite scroll ---
  const parentRef = tableContainerRef;
  const rowVirtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 54, // Approximate row height
    overscan: 8,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  // Only render visible rows, but keep table layout
  const visibleRows = virtualRows.map(vr => table.getRowModel().rows[vr.index]);

  // Remove any custom context menu logic and prevent right-click menu
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    const table = document.getElementById('inventory-table-root');
    if (table) {
      table.addEventListener('contextmenu', handleContextMenu);
      return () => table.removeEventListener('contextmenu', handleContextMenu);
    }
  }, []);

  // Refresh items function (calls parent fetch if available)
  // const refreshItems = () => {
  //   if (typeof window !== 'undefined' && window.location) {
  //     window.location.reload(); // fallback, or trigger parent fetch if available
  //   }
  // };

  // Reference for the search input
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search bar on Enter (when no modal is open)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const modalOpen = !!document.querySelector('.global-modal');
      if (
        e.key === 'Enter' &&
        !modalOpen &&
        searchInputRef.current &&
        document.activeElement !== searchInputRef.current
      ) {
        e.preventDefault();
        setSearch(""); // Clear the input when focusing
        searchInputRef.current.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSearch]);

  // Keyboard navigation state
  const [selectedRowIdx, setSelectedRowIdx] = useState<number | null>(null);

  // Track if row action hotkeys (d/s) are enabled
  const [hotkeysEnabled, setHotkeysEnabled] = useState(false);

  // Disable hotkeys when search is focused or changed
  useEffect(() => {
    setHotkeysEnabled(false);
  }, [search]);

  // Arrow key navigation (up/down)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const modalOpen = !!document.querySelector('.global-modal');
      const active = document.activeElement as HTMLElement | null;
      // Arrow keys: enable hotkeys after user navigates
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !modalOpen) {
        setHotkeysEnabled(true);
      }
      // D: Open price history modal for selected item (only if hotkeys enabled)
      if (
        e.key === 'd' &&
        hotkeysEnabled &&
        !modalOpen &&
        selectedRowIdx != null &&
        visibleRows[selectedRowIdx]
      ) {
        e.preventDefault();
        openHistoryModal(visibleRows[selectedRowIdx].original);
        return;
      }
      // S: Open stock modal for selected item (only if hotkeys enabled)
      if (
        e.key === 's' &&
        hotkeysEnabled &&
        !modalOpen &&
        selectedRowIdx != null &&
        visibleRows[selectedRowIdx]
      ) {
        e.preventDefault();
        handleOpenStockDialog(visibleRows[selectedRowIdx].original.$id);
        return;
      }
      // If search bar is focused and arrow up/down pressed, blur and allow navigation
      if (
        (e.key === 'ArrowDown' || e.key === 'ArrowUp') &&
        active &&
        active === searchInputRef.current &&
        !modalOpen
      ) {
        e.preventDefault();
        searchInputRef.current?.blur();
        setSelectedRowIdx(0); // Always start at the first item
        return;
      }
      if (
        (e.key === 'ArrowDown' || e.key === 'ArrowUp') &&
        !modalOpen &&
        active?.tagName !== 'INPUT' &&
        active?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        setSelectedRowIdx(prev => {
          const maxIdx = visibleRows.length - 1;
          if (prev == null) return e.key === 'ArrowDown' ? 0 : maxIdx;
          if (e.key === 'ArrowDown') return Math.min(prev + 1, maxIdx);
          if (e.key === 'ArrowUp') return Math.max(prev - 1, 0);
          return prev;
        });
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visibleRows, selectedRowIdx, hotkeysEnabled, search]);

  // Scroll selected row into view
  useEffect(() => {
    if (selectedRowIdx != null && rowVirtualizer && rowVirtualizer.scrollToIndex) {
      rowVirtualizer.scrollToIndex(selectedRowIdx);
    }
  }, [selectedRowIdx, rowVirtualizer]);

  // Show loading if itemStats or priceHistory are not ready
  if (itemStatsLoading || priceHistoryLoading) {
    return <div style={{padding: 40, textAlign: 'center', color: '#bbb', fontSize: 20}}>Loading stats…</div>;
  }

  return (
    <div style={{ flex: 1, minWidth: 0, paddingLeft: 14 }}>
      <div className="search-row" style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: 15 }}>
        {/* Input + icon wrapper */}
        <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
          <input
            ref={searchInputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setHotkeysEnabled(false)}
            placeholder="Search items..."
            className="row search-input"
            style={{
              width: '100%',
              paddingRight: 40, // ensure space for icon
              height: 40,
              fontSize: 18,
              borderRadius: 8,
              border: '1px solid #333',
              background: '#232323',
              color: '#eee',
              fontWeight: 500,
              boxSizing: 'border-box',
            }}
          />
          {/* Hotkey legend icon absolutely inside input wrapper */}
          <span
            tabIndex={0}
            style={{
              position: 'absolute',
              right: 20,
              top: '50%',
              transform: 'translateY(-50%)',
              background: '#222',
              color: '#bbb',
              borderRadius: '50%',
              width: 22,
              height: 22,
              fontSize: 15,
              fontWeight: 700,
              textAlign: 'center',
              lineHeight: '22px',
              cursor: 'pointer',
              boxShadow: '0 1px 4px #0002',
              userSelect: 'none',
              outline: 'none',
              border: 'none',
              zIndex: 12,
              transition: 'background 0.15s',
              pointerEvents: 'auto',
            }}
            onFocus={e => e.currentTarget.setAttribute('data-show', '1')}
            onBlur={e => e.currentTarget.removeAttribute('data-show')}
            onMouseEnter={e => e.currentTarget.setAttribute('data-show', '1')}
            onMouseLeave={e => e.currentTarget.removeAttribute('data-show')}
            aria-label="Show hotkey guide"
          >
            ?
          </span>
          <div
            style={{
              display: 'none',
              position: 'absolute',
              top: 38,
              right: 20,
              minWidth: 200,
              maxWidth: 270,
              background: 'rgba(32,32,32,0.97)',
              color: '#bbb',
              borderRadius: 6,
              padding: '12px 14px 10px 14px',
              fontSize: 14,
              lineHeight: 1.7,
              boxShadow: '0 2px 8px #0004',
              zIndex: 100,
              pointerEvents: 'auto',
              whiteSpace: 'normal',
            }}
            className="hotkey-tooltip"
          >
            <div style={{fontWeight: 700, fontSize: 15, marginBottom: 2, letterSpacing: 0.2}}>Hotkeys</div>
            <ul style={{paddingLeft: 18, margin: '7px 0 10px 0'}}>
              <li><span style={{fontWeight:600, color:'#fff'}}>Arrow Keys</span>: Navigate rows</li>
              <li><span style={{fontWeight:600, color:'#fff'}}>D</span>: Show price history (when a row is selected)</li>
              <li><span style={{fontWeight:600, color:'#fff'}}>S</span>: Show stock modal (when a row is selected)</li>
              <li><span style={{fontWeight:600, color:'#fff'}}>Enter</span>: Focus search bar</li>
            </ul>
            <div style={{color:'#888', fontSize:12, marginTop: 8}}>
              Hotkeys are disabled while typing in the search bar.<br />
              Use arrow keys to re-enable.
            </div>
          </div>
          <style>{`
            .hotkey-tooltip {
              display: none;
            }
            span[data-show="1"] + .hotkey-tooltip {
              display: block !important;
            }
          `}</style>
        </div>
        {/* Add Item button remains outside input wrapper */}
        <button
          className="add-btn"
          onClick={() => isAdmin && setModalOpen(true)}
          disabled={!isAdmin}
          style={{
            marginLeft: 14,
            height: 40,
            fontSize: 16,
            opacity: isAdmin ? 1 : 0.5,
            cursor: isAdmin ? 'pointer' : 'not-allowed',
          }}
        >Add Item</button>
      </div>
      <div
        ref={tableContainerRef}
        id="inventory-table-root"
        style={{
          width: '100%',
          height: 'calc(100vh - 148px)',
          overflow: 'hidden',
          position: 'relative',
          background: '#181818',
          borderRadius: 12,
          boxShadow: '0 2px 12px #0002',
          marginBottom: 0,
        }}
      >
        <table className="styled-table" style={{ width: '100%', minWidth: 600, tableLayout: 'fixed' }}>
          <colgroup><col style={{ width: 80 }} /><col style={{ width: '50%' }} /><col style={{ width: '10%' }} /><col style={{ width: '10%' }} /><col style={{ width: '10%' }} /></colgroup>
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th key={header.id} onClick={header.column.getToggleSortingHandler()} style={{ cursor: header.column.getCanSort() ? 'pointer' : undefined, userSelect: 'none' }}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              <tr style={{ height: Math.max(340, table.getRowModel().rows.length * 48) }}>
                <td colSpan={columns.length} style={{ padding: 0, border: 'none', background: 'transparent', height: '100%' }}>
                  <div style={{ width: '100%', minHeight: 340, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <Spinner size={48} />
                  </div>
                </td>
              </tr>
            ) : (
              <>
                {/* Spacer row before visible rows */}
                {virtualRows.length > 0 && (
                  <tr style={{ height: virtualRows[0].start }}>
                    <td colSpan={columns.length} style={{ padding: 0, border: 'none', background: 'transparent' }} />
                  </tr>
                )}
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
                      style={{
                        cursor: 'pointer',
                        background:
                          selectedRowIdx === i ? '#3a3a3a' : (virtualRows[i]?.index ?? 0) % 2 === 1 ? '#292929' : '#202020',
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
                      <td colSpan={columns.length} style={{ padding: 0, background: (virtualRows[i]?.index ?? 0) % 2 === 1 ? '#292929' : "#202020", borderTop: 'none' }}>
                        <div
                          className="compact subrow-bar"
                          style={{
                            width: '100%',
                            margin: '0',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            alignItems: 'flex-start',
                            fontSize: '11px',
                            color: '#bbb',
                            padding: '2px 0 2px 8px',
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
                                <span style={{ marginRight: 24 }}>P75: {format(stats?.p75)}</span>
                              </>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
                {/* Spacer row after visible rows */}
                {virtualRows.length > 0 && (
                  <tr style={{ height: totalSize - (virtualRows[virtualRows.length-1]?.end ?? 0) }}>
                    <td colSpan={columns.length} style={{ padding: 0, border: 'none', background: 'transparent' }} />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
