import { useState, useEffect, createContext, useContext, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { FuseResult } from "fuse.js";
import Fuse from "fuse.js";
import { Item } from "./types";
import "./App.css";
import './sticky-table.css';
import './compact.css';
import { Toolbar } from "./Toolbar";
import { Modal } from "./Modal";
import { ContextMenu } from "./ContextMenu";
import { PriceHistoryModal, PriceEntry } from "./PriceHistoryModal";
import { SellModal } from "./SellModal";
import { ItemNameAutocomplete } from "./ItemNameAutocomplete";
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { SectionHeader } from "./SectionHeader";
import { StockDialog } from "./StockDialog";
import { ShopItemModal } from "./ShopItemModal";
import { InventoryContextMenu } from "./InventoryContextMenu";
import { CharacterDropdown } from "./CharacterDropdown";
import TitleBar from "./TitleBar";

// Global UI settings context
export interface UISettings {
  round50k: boolean;
  showUnsold: boolean;
  setRound50k: (val: boolean) => void;
  setShowUnsold: (val: boolean) => void;
  compactMode: boolean;
  setCompactMode: (val: boolean) => void;
}
export const UISettingsContext = createContext<UISettings | null>(null);

// Helper for 'x days ago'
function daysAgo(dateStr?: string): string {
  if (!dateStr) return "Never";
  const then = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Today";
  if (diff === 1) return "1 day ago";
  return `${diff} days ago`;
}

// Toggle switch component
function OwnedToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onChange(!checked); }}
      aria-pressed={checked}
      style={{
        width: 44,
        height: 26,
        borderRadius: 13,
        border: '2px solid #2d8cff',
        background: checked ? '#2d8cff' : '#eee',
        position: 'relative',
        cursor: 'pointer',
        outline: 'none',
        transition: 'background 0.18s',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: checked ? 'flex-end' : 'flex-start',
        padding: 0,
      }}
      tabIndex={0}
    >
      <span
        style={{
          display: 'block',
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: checked ? '0 0 4px #2d8cff99' : '0 0 2px #888',
          margin: 2,
          transition: 'box-shadow 0.18s',
        }}
      />
    </button>
  );
}

interface InventorySection {
  id: string;
  name: string;
  itemIds: number[];
}

function uuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface Character {
  id: string;
  name: string;
  shop: {
    itemCounts: Record<number, number>; // itemId -> count
    order: number[]; // array of itemIds for display order (no duplicates)
  };
}

function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [editing, setEditing] = useState<Item | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalIGN, setModalIGN] = useState(false);
  const [modalAbout, setModalAbout] = useState(false);
  const [ign, setIGN] = useState(localStorage.getItem("ign") || "");
  const [ignInput, setIGNInput] = useState(ign);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: Item | null }>({ x: 0, y: 0, item: null });
  const [priceHistoryModal, setPriceHistoryModal] = useState<{ open: boolean, itemId?: number }>({ open: false });
  const [round50k, setRound50k] = useState(() => {
    const val = localStorage.getItem("round50k");
    return val ? val === "true" : false;
  });
  const [showUnsold, setShowUnsold] = useState(() => {
    const val = localStorage.getItem("showUnsold");
    return val ? val === "true" : false;
  });
  const [compactMode, setCompactMode] = useState(false);
  const [sellModalOpen, setSellModalOpen] = useState(false);
  const [sellItem, setSellItem] = useState<Item | null>(null);
  const [priceStats, setPriceStats] = useState<Record<number, {recent?: PriceEntry, high7d?: PriceEntry}>>({});
  const [sellError, setSellError] = useState<string | null>(null);
  const [showOwnedOnly, setShowOwnedOnly] = useState(false);
  const [sortKey, setSortKey] = useState<'name' | 'current_selling_price' | 'last_sold'>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [ownedItems, setOwnedItems] = useState<Item[]>([]);
  const [characters, setCharacters] = useState<Character[]>(() => {
    const saved = localStorage.getItem('characters');
    if (saved) {
      return JSON.parse(saved).map((c: any) => ({
        ...c,
        shop: c.shop && typeof c.shop === 'object'
          ? {
              itemCounts: c.shop.itemCounts || {},
              order: Array.isArray(c.shop.order) ? c.shop.order : []
            }
          : { itemCounts: {}, order: [] }
      }));
    }
    return [];
  });
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(() => {
    const saved = localStorage.getItem('selectedCharacterId');
    if (saved) return saved;
    return null;
  });
  const [addCharacterPrompt, setAddCharacterPrompt] = useState(false);
  const tableRowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});
  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const [highlightedRow, setHighlightedRow] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string, visible: boolean }>({ msg: '', visible: false });
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tableScrollTop, setTableScrollTop] = useState(0);

  // Persist characters to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('characters', JSON.stringify(characters));
  }, [characters]);

  useEffect(() => {
    if (characters.length === 0) setAddCharacterPrompt(true);
    else setAddCharacterPrompt(false);
  }, [characters]);

  // --- Stock dialog state ---
  const [stockDialog, setStockDialog] = useState<{ open: boolean, itemId?: number }>({ open: false });
  const [stockDialogDefault, setStockDialogDefault] = useState(1);

  function handleOpenStockDialog(itemId: number) {
    // Find the selected character and the item's current stock for that character
    const char = characters.find(c => c.id === selectedCharacterId);
    const stock = char?.shop?.itemCounts?.[itemId] ?? 0;
    setStockDialogDefault(stock);
    setStockDialog({ open: true, itemId });
  }
  function handleCloseStockDialog() {
    setStockDialog({ open: false });
  }
  function handleStock(characterId: string, amount: number) {
    if (!stockDialog.itemId) return;
    setCharacters(chars => chars.map(c => {
      if (!c.shop || typeof c.shop !== 'object') {
        // Defensive: ensure shop is always an object
        c = { ...c, shop: { itemCounts: {}, order: [] } };
      }
      if (c.id !== characterId) return c;
      // Set the stock to the absolute value provided
      const counts = { ...(c.shop.itemCounts || {}) };
      const order = Array.isArray(c.shop.order) ? c.shop.order.slice() : [];
      counts[stockDialog.itemId!] = amount;
      if (!order.includes(stockDialog.itemId!)) order.push(stockDialog.itemId!);
      return { ...c, shop: { itemCounts: counts, order } };
    }));
    setStockDialog({ open: false });
  }

  // --- Shop item modal state ---
  const [shopItemModal, setShopItemModal] = useState<{ open: boolean, itemId?: number }>({ open: false });

  function handleOpenShopItemModal(itemId: number) {
    setShopItemModal({ open: true, itemId });
  }
  function handleCloseShopItemModal() {
    setShopItemModal({ open: false });
  }

  async function handleShopItemSell(sellCount: number) {
    if (!shopItemModal.itemId || !selectedCharacter) return;
    setSellError(null);
    const item = itemMap[shopItemModal.itemId];
    if (!item) return;
    const author = ign || 'Unknown';
    const now = new Date().toISOString();
    try {
      for (let i = 0; i < sellCount; ++i) {
        await invoke("add_price_history", {
          itemId: item.id,
          price: item.current_selling_price,
          date: now,
          author,
          sold: true
        });
      }
      // Decrement stock count in shop
      setCharacters(chars => chars.map(c => {
        if (c.id !== selectedCharacter.id) return c;
        const counts = { ...(c.shop.itemCounts || {}) };
        const id = item.id;
        counts[id] = Math.max(0, (counts[id] || 0) - sellCount);
        // Remove from order if count is now 0
        let order = Array.isArray(c.shop.order) ? c.shop.order.slice() : [];
        if (counts[id] <= 0) {
          delete counts[id];
          order = order.filter(itemId => itemId !== id);
        }
        return { ...c, shop: { itemCounts: counts, order } };
      }));
      setShopItemModal({ open: false });
      fetchItems();
    } catch (err: any) {
      setSellError('Failed to record sale: ' + (err?.message || err));
      setToast({ msg: `Error: ${err?.toString() || err}`, visible: true });
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => setToast(t => ({ ...t, visible: false })), 2600);
      // Optionally log to console for dev
      console.error('Sell error:', err);
    }
  }

  function handleShopItemRemove() {
    if (!shopItemModal.itemId || !selectedCharacter) return;
    setCharacters(chars => chars.map(c => {
      if (c.id !== selectedCharacter.id) return c;
      const counts = { ...(c.shop.itemCounts || {}) };
      const id = shopItemModal.itemId!;
      delete counts[id];
      const order = Array.isArray(c.shop.order) ? c.shop.order.filter(itemId => itemId !== id) : [];
      return { ...c, shop: { itemCounts: counts, order } };
    }));
    setShopItemModal({ open: false });
  }

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    if (!search) {
      setFilteredItems(items);
    } else {
      const fuse = new Fuse(items, { keys: ["name"], threshold: 0.4 });
      setFilteredItems(fuse.search(search).map((r) => (r as FuseResult<Item>).item));
    }
  }, [search, items]);

  useEffect(() => {
    localStorage.setItem("round50k", String(round50k));
  }, [round50k]);
  useEffect(() => {
    localStorage.setItem("showUnsold", String(showUnsold));
  }, [showUnsold]);

  useEffect(() => {
    localStorage.setItem('selectedCharacterId', selectedCharacterId || '');
  }, [selectedCharacterId]);

  useEffect(() => {
    if (!items.length) return;
    setOwnedItems(items.filter(item => item.owned));
  }, [items]);

  useEffect(() => {
    let cancelled = false;
    async function fetchStats() {
      const stats: Record<number, {recent?: PriceEntry, high7d?: PriceEntry}> = {};
      const now = Date.now();
      const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
      for (const item of items) {
        const history: PriceEntry[] = await invoke("get_price_history", { itemId: item.id });
        const soldHistory = history.filter(e => e.sold);
        if (soldHistory.length > 0) {
          stats[item.id] = {
            recent: soldHistory[0],
            high7d: soldHistory.filter(e => new Date(e.date).getTime() >= weekAgo)
              .sort((a, b) => b.price - a.price)[0]
          };
        } else {
          stats[item.id] = {};
        }
      }
      if (!cancelled) setPriceStats(stats);
    }
    if (items.length) fetchStats();
    return () => { cancelled = true; };
  }, [items]);

  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;
    const handleScroll = () => setTableScrollTop(container.scrollTop);
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  async function fetchItems() {
    const result = await invoke<Item[]>("get_items");
    setItems(result.map(item => ({ ...item, priceHistory: item.priceHistory || [] })));
  }

  async function handleAddOrEdit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editing) {
        await invoke("update_item", { id: editing.id, name, currentSellingPrice: parseFloat(price), owned: editing.owned ?? false });
      } else {
        await invoke("add_item", { name, currentSellingPrice: parseFloat(price), owned: false });
      }
      setModalOpen(false);
      setName("");
      setPrice("");
      setEditing(null);
      fetchItems();
    } catch (err: any) {
      setToast({ msg: `Error: ${err?.toString() || err}`, visible: true });
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => setToast(t => ({ ...t, visible: false })), 2600);
    }
  }

  async function handleDelete(id: number) {
    await invoke("delete_item", { id });
    fetchItems();
  }

  function handleSetIGN(e: React.FormEvent) {
    e.preventDefault();
    setIGN(ignInput);
    localStorage.setItem("ign", ignInput);
    setModalIGN(false);
  }

  function openHistoryModal(item: Item) {
    setPriceHistoryModal({ open: true, itemId: item.id });
  }

  async function handleSell(item: Item, amount: number, price: number, markUnowned?: boolean) {
    const author = ign || 'Unknown';
    const now = new Date().toISOString();
    setSellError(null);
    try {
      for (let i = 0; i < amount; ++i) {
        await invoke("add_price_history", {
          itemId: item.id,
          price,
          date: now,
          author,
          sold: true
        });
      }
      if (markUnowned) {
        await invoke("update_item", {
          id: item.id,
          name: item.name,
          currentSellingPrice: item.current_selling_price,
          owned: false
        });
      }
      setSellModalOpen(false);
      setSellItem(null);
      fetchItems();
    } catch (err: any) {
      setSellError('Failed to record sale: ' + (err?.message || err));
      setToast({ msg: `Error: ${err?.toString() || err}`, visible: true });
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => setToast(t => ({ ...t, visible: false })), 2600);
      // Optionally log to console for dev
      console.error('Sell error:', err);
    }
  }

  function handleInventoryDragEnd(result: DropResult) {
    if (!result.destination || result.source.index === result.destination.index) return;
    const destination = result.destination;
    setCharacters(chars => chars.map(c => {
      if (c.id !== selectedCharacterId) return c;
      const order = Array.from(c.shop.order);
      const [removed] = order.splice(result.source.index, 1);
      order.splice(destination.index, 0, removed);
      return { ...c, shop: { ...c.shop, order } };
    }));
  }

  function handleInventoryItemClick(item: Item) {
    // Scroll only the table container
    const tr = tableRowRefs.current[item.id];
    const container = tableContainerRef.current;
    if (tr && container) {
      const trRect = tr.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const scrollOffset = tr.offsetTop - container.offsetTop - (container.clientHeight / 2) + (tr.clientHeight / 2);
      container.scrollTo({ top: scrollOffset, behavior: 'smooth' });
      setHighlightedRow(item.id);
      setTimeout(() => {
        setHighlightedRow(h => (h === item.id ? null : h));
      }, 1800);
    }
    // Copy price to clipboard
    if (item.current_selling_price !== undefined) {
      navigator.clipboard.writeText(item.current_selling_price.toString());
      setToast({ msg: `Copied price for ${item.name}`, visible: true });
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => setToast(t => ({ ...t, visible: false })), 1700);
    }
  }

  // Filtering and sorting logic
  const filteredAndSortedItems = items
    .filter(item => !showOwnedOnly || item.owned)
    .filter(item => item.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'current_selling_price') cmp = a.current_selling_price - b.current_selling_price;
      else if (sortKey === 'last_sold') {
        const aRecent = priceStats[a.id]?.recent;
        const aDate = aRecent && aRecent.date ? new Date(aRecent.date).getTime() : 0;
        const bRecent = priceStats[b.id]?.recent;
        const bDate = bRecent && bRecent.date ? new Date(bRecent.date).getTime() : 0;
        cmp = aDate - bDate;
      }
      return sortAsc ? cmp : -cmp;
    });

  // Table header sort click handler
  function handleSort(col: 'name' | 'current_selling_price' | 'last_sold') {
    if (sortKey === col) setSortAsc(a => !a);
    else {
      setSortKey(col);
      setSortAsc(true);
    }
  }

  const itemMap = Object.fromEntries(items.map(i => [i.id, i]));

  const selectedCharacter = characters.find(c => c.id === selectedCharacterId);

  // Character deletion handler
  function handleDeleteCharacter(id: string) {
    if (!window.confirm('Are you sure you want to delete this character? This cannot be undone.')) return;
    setCharacters(chars => chars.filter(c => c.id !== id));
    // If the deleted character was selected, switch to another or clear selection
    setSelectedCharacterId(prev => {
      if (prev === id) {
        const remaining = characters.filter(c => c.id !== id);
        return remaining.length > 0 ? remaining[0].id : null;
      }
      return prev;
    });
  }

  function handleAddCharacter() {
    const name = prompt('Enter new character name:');
    if (!name) return;
    const newChar = { id: uuid(), name, shop: { itemCounts: {}, order: [] } };
    setCharacters(chars => [...chars, newChar]);
    setSelectedCharacterId(newChar.id);
  }

  function handleCharacterChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedCharacterId(e.target.value);
  }

  // --- Context menu state for inventory panel ---
  const [inventoryContextMenu, setInventoryContextMenu] = useState<{ open: boolean, x: number, y: number, itemId?: number }>({ open: false, x: 0, y: 0 });

  function handleInventoryContextMenu(e: React.MouseEvent, itemId: number) {
    e.preventDefault();
    setInventoryContextMenu({ open: true, x: e.clientX, y: e.clientY, itemId });
  }
  function handleCloseInventoryContextMenu() {
    setInventoryContextMenu({ ...inventoryContextMenu, open: false });
  }
  function handleAdjustStock() {
    if (inventoryContextMenu.itemId) {
      setStockDialog({ open: true, itemId: inventoryContextMenu.itemId });
    }
  }
  function handlePriceHistory() {
    if (inventoryContextMenu.itemId) setPriceHistoryModal({ open: true, itemId: inventoryContextMenu.itemId });
  }
  function handleRecordSale() {
    if (inventoryContextMenu.itemId) {
      setSellItem(itemMap[inventoryContextMenu.itemId]);
      setSellModalOpen(true);
    }
  }
  function handleDeleteInventoryItem() {
    if (!inventoryContextMenu.itemId || !selectedCharacter) return;
    setCharacters(chars => chars.map(c => {
      if (c.id !== selectedCharacter.id) return c;
      const counts = { ...(c.shop.itemCounts || {}) };
      const id = inventoryContextMenu.itemId!;
      delete counts[id];
      const order = Array.isArray(c.shop.order) ? c.shop.order.filter(itemId => itemId !== id) : [];
      return { ...c, shop: { itemCounts: counts, order } };
    }));
  }

  return (
    <UISettingsContext.Provider value={{ round50k, showUnsold, setRound50k, setShowUnsold, compactMode, setCompactMode }}>
      <TitleBar />
      <main className={`container${compactMode ? ' compact' : ''}`} style={{ paddingTop: 32 }}>
        {addCharacterPrompt && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.88)', color: '#fff', zIndex: 4000,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <h2 style={{ marginBottom: 24 }}>No characters found</h2>
            <button style={{ fontSize: 18, padding: '12px 32px', borderRadius: 10, background: '#2d8cff', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }} onClick={handleAddCharacter}>
              Add Character
            </button>
          </div>
        )}
        <Toolbar
          onSetIGN={() => setModalIGN(true)}
          onAbout={() => setModalAbout(true)}
          ign={ign}
          compactMode={compactMode}
          setCompactMode={setCompactMode}
        />
        <div style={{ display: 'flex', flexDirection: 'row', height: '100vh', minHeight: 0 }}>
          {/* Inventory Side Panel */}
          <aside
            className="inventory-panel-scroll"
            style={{
              width: 270,
              minWidth: 230,
              maxWidth: 340,
              background: '#232323',
              borderRight: '1.5px solid #333',
              padding: '24px 14px 24px 18px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 13, color: '#fff', letterSpacing: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Inventory</span>
              <button onClick={handleAddCharacter} style={{ background: 'none', border: 'none', color: '#2d8cff', fontSize: 20, cursor: 'pointer' }} title="Add Character">＋</button>
            </div>
            <CharacterDropdown
              characters={characters}
              selectedCharacterId={selectedCharacterId}
              onSelect={setSelectedCharacterId}
              onDelete={handleDeleteCharacter}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
            </div>
            <div
              className="inventory-scrollbar-hide"
              style={{
                overflowY: 'auto',
                height: 'calc(100vh - 70px - 48px - 38px)',
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 6,
                background: '#232323',
                boxShadow: '0 2px 8px #0002',
                padding: '2px 0',
              }}
            >
              {selectedCharacter && selectedCharacter.shop ? (
                Array.isArray(selectedCharacter.shop.order) ? (
                  <DragDropContext onDragEnd={handleInventoryDragEnd}>
                    <Droppable droppableId="shop-inventory" type="item">
                      {(provided, snapshot) => (
                        <div ref={provided.innerRef} {...provided.droppableProps} style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 40, maxHeight: 'calc(100vh - 180px)', overflowY: 'auto', paddingBottom: 200 }}>
                          {selectedCharacter.shop.order.map((itemId, idx) => {
                            const item = itemMap[itemId];
                            if (!item) return null;
                            const count = selectedCharacter.shop.itemCounts[itemId] || 0;
                            return (
                              <Draggable key={item.id} draggableId={item.id.toString()} index={idx}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      fontSize: 15,
                                      color: '#e0e0e0',
                                      padding: '7px 0',
                                      borderBottom: '1px solid #333',
                                      gap: 10,
                                      background: snapshot.isDragging ? '#2d8cff22' : undefined,
                                      cursor: 'grab',
                                      userSelect: 'none',
                                      ...provided.draggableProps.style,
                                    }}
                                    onClick={() => {
                                      if (item.current_selling_price !== undefined) {
                                        navigator.clipboard.writeText(item.current_selling_price.toString());
                                        setToast({ msg: `Copied price for ${item.name}`, visible: true });
                                        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
                                        toastTimeoutRef.current = setTimeout(() => setToast(t => ({ ...t, visible: false })), 1700);
                                      }
                                    }}
                                    onContextMenu={e => {
                                      e.preventDefault();
                                      setInventoryContextMenu({ open: true, x: e.clientX, y: e.clientY, itemId: item.id });
                                    }}
                                  >
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                                      <span style={{ fontWeight: 600, wordBreak: 'break-word', whiteSpace: 'normal', fontSize: 16, lineHeight: 1.18 }}>{item.name}</span>
                                      <span style={{ color: '#a88f4a', fontWeight: 500, fontSize: 13, marginTop: 2 }}>{item.current_selling_price?.toLocaleString() ?? '-'}</span>
                                    </div>
                                    <span
                                      style={{
                                        color: 'rgba(60,40,16,0.92)',
                                        background: 'linear-gradient(90deg, #f8ecd5 0%, #e6d3a5 50%, #bfa16a 100%)',
                                        borderRadius: 999,
                                        padding: '3px 14px',
                                        marginLeft: 10,
                                        fontWeight: 700,
                                        fontSize: 15,
                                        minWidth: 32,
                                        textAlign: 'center',
                                        boxShadow: '0 2px 8px #0002',
                                        border: '1.5px solid #e0c08080',
                                        lineHeight: 1.25,
                                        display: 'inline-block',
                                        filter: 'drop-shadow(0 1px 2px #fff6) drop-shadow(0 -1px 2px #bfa16a44)',
                                      }}
                                    >{count}x</span>
                                  </div>
                                )}
                              </Draggable>
                            );
                          })}
                          {selectedCharacter.shop.order.length === 0 && (
                            <div style={{ color: '#888', fontSize: 15, marginTop: 4, marginBottom: 6 }}>No items</div>
                          )}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                ) : (
                  <div style={{ color: '#888', fontSize: 15 }}>No items</div>
                )
              ) : (
                <div style={{ color: '#888', fontSize: 15 }}>No character or shop selected.</div>
              )}
            </div>
          </aside>
          {/* Main Content */}
          <div style={{ flex: 1, minWidth: 0, paddingLeft: 14 /* matches inventory panel's right padding */ }}>
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
                background: 'transparent', // Ensure last row is never cut off
              }}
            >
              {tableContainerRef.current && tableScrollTop > 0 && (
                <div
                  style={{
                    position: 'fixed',
                    top: tableContainerRef.current.getBoundingClientRect().top,
                    left: tableContainerRef.current.getBoundingClientRect().left,
                    width: tableContainerRef.current.offsetWidth,
                    zIndex: 100,
                    // pointerEvents: 'none',
                    // transition: 'box-shadow 0.2s',
                    // boxShadow: '0 2px 8px rgba(0,0,0,0.13)',
                  }}
                >
                  <table className="styled-table sticky-table" style={{ width: '100%', tableLayout: 'fixed' }}>
                    <thead>
                      <tr>
                        <th>Stock</th>
                        <th style={{ cursor: 'pointer', width: '30%' }}>Name {sortKey === 'name' && (sortAsc ? '▲' : '▼')}</th>
                        <th style={{ cursor: 'pointer' }}>Price {sortKey === 'current_selling_price' && (sortAsc ? '▲' : '▼')}</th>
                        <th style={{ cursor: 'pointer' }}>Last Sold {sortKey === 'last_sold' && (sortAsc ? '▲' : '▼')}</th>
                        <th>Recent Sold</th>
                        <th>High Sold (7d)</th>
                        <th></th>
                      </tr>
                    </thead>
                  </table>
                </div>
              )}
              <table className="styled-table sticky-table" style={{ width: '100%', tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th>Stock</th>
                    <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', width: '30%' }}>
                      Name {sortKey === 'name' && (sortAsc ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('current_selling_price')} style={{ cursor: 'pointer' }}>
                      Price {sortKey === 'current_selling_price' && (sortAsc ? '▲' : '▼')}
                    </th>
                    <th onClick={() => handleSort('last_sold')} style={{ cursor: 'pointer' }}>
                      Last Sold {sortKey === 'last_sold' && (sortAsc ? '▲' : '▼')}
                    </th>
                    <th>Recent Sold</th>
                    <th>High Sold (7d)</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedItems.map((item) => (
                    <tr
                      key={item.id}
                      ref={el => (tableRowRefs.current[item.id] = el)}
                      onClick={e => {
                        // Only trigger if the click is not on a button, input, or interactive element
                        if (
                          e.target instanceof HTMLElement &&
                          (e.target.tagName === 'BUTTON' ||
                            e.target.tagName === 'A' ||
                            e.target.tagName === 'INPUT' ||
                            e.target.closest('button, a, input'))
                        ) {
                          return;
                        }
                        openHistoryModal(item);
                      }}
                      onContextMenu={e => handleInventoryContextMenu(e, item.id)}
                      style={{
                        cursor: 'pointer',
                        background: highlightedRow === item.id ? '#2d8cff33' : undefined,
                        transition: 'background 0.3s',
                      }}
                    >
                      <td>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); handleOpenStockDialog(item.id); }}
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
                      </td>
                      <td>{item.name}</td>
                      <td>{item.current_selling_price?.toLocaleString()}</td>
                      <td>{daysAgo(priceStats[item.id]?.recent?.date)}</td>
                      <td>{priceStats[item.id]?.recent ? priceStats[item.id]!.recent!.price.toLocaleString() : '-'}</td>
                      <td>{priceStats[item.id]?.high7d ? priceStats[item.id]!.high7d!.price.toLocaleString() : '-'}</td>
                      <td>
                        <button
                          style={{ background: '#4caf50', color: '#fff', fontWeight: 600, border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}
                          onClick={e => { e.stopPropagation(); setSellItem(item); setSellModalOpen(true); }}
                          aria-label="Sell"
                        >
                          <img src="/placeholder-sell.png" alt="Sell" style={{ width: 24, height: 24, objectFit: 'contain' }} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {/* Spacer row for extra bottom space */}
                  <tr>
                    <td colSpan={7} style={{ height: 160, border: 'none', background: 'transparent', pointerEvents: 'none' }} />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
          <h2>{editing ? "Edit Item" : "Add Item"}</h2>
          <form onSubmit={handleAddOrEdit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <ItemNameAutocomplete
              value={name}
              onChange={setName}
              placeholder="Item name"
              required
              autoFocus
              existingItems={items.map(i => i.name)}
              style={{ width: "100%", boxSizing: "border-box" }}
            />
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Current Price"
              type="number"
              min="0"
              step="0.01"
              required
              style={{ width: "100%", boxSizing: "border-box" }}
            />
            {items.some(i => i.name.trim().toLowerCase() === name.trim().toLowerCase()) && !editing && (
              <div style={{ color: '#2d8cff', fontWeight: 500, fontSize: 15, marginTop: -6 }}>
                This item already exists and cannot be added again.
              </div>
            )}
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button type="submit" disabled={items.some(i => i.name.trim().toLowerCase() === name.trim().toLowerCase()) && !editing}>Save</button>
              <button type="button" onClick={() => setModalOpen(false)}>Cancel</button>
            </div>
          </form>
        </Modal>
        <Modal open={modalIGN} onClose={() => setModalIGN(false)}>
          <h2>Set In-Game Name</h2>
          <form onSubmit={handleSetIGN} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              value={ignInput}
              onChange={e => setIGNInput(e.target.value)}
              placeholder="Enter your IGN"
              autoFocus
            />
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button type="submit">Save</button>
              <button type="button" onClick={() => setModalIGN(false)}>Cancel</button>
            </div>
          </form>
        </Modal>
        <Modal open={modalAbout} onClose={() => setModalAbout(false)}>
          <h2>About</h2>
          <p>Inventory Tracker v0.1<br />Cross-platform desktop app for tracking game items.<br />Built with Tauri + React.</p>
        </Modal>
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          open={!!contextMenu.item}
          onClose={() => setContextMenu({ x: 0, y: 0, item: null })}
          actions={contextMenu.item ? [
            {
              label: "Edit",
              icon: <span aria-hidden="true">✎</span>,
              onClick: () => setEditing(contextMenu.item!)
            },
            {
              label: "Delete",
              icon: <span aria-hidden="true">🗑</span>,
              onClick: () => handleDelete(contextMenu.item!.id)
            },
            {
              label: "Record Sale...",
              icon: <span aria-hidden="true">📈</span>,
              onClick: () => {
                setSellItem(contextMenu.item!);
                setSellModalOpen(true);
              }
            }
          ] : []}
        />
        {priceHistoryModal.open && priceHistoryModal.itemId && (
          <PriceHistoryModal
            open={priceHistoryModal.open}
            onClose={() => setPriceHistoryModal({ open: false })}
            itemId={priceHistoryModal.itemId}
            itemName={itemMap[priceHistoryModal.itemId]?.name || ''}
            currentPrice={itemMap[priceHistoryModal.itemId]?.current_selling_price ?? 0}
            onSetPrice={price => {
              // When a new price is set, refresh items so main table and all state update
              fetchItems();
            }}
          />
        )}
        <SellModal
          open={sellModalOpen}
          onClose={() => { setSellModalOpen(false); setSellItem(null); setSellError(null); }}
          onSell={(amount, price, markUnowned) => sellItem && handleSell(sellItem, amount, price, markUnowned)}
          itemName={sellItem?.name || ''}
          defaultPrice={sellItem?.current_selling_price}
        />
        {sellError && (
          <div style={{ color: '#f55', marginTop: 8, fontWeight: 500 }}>{sellError}</div>
        )}
        {toast.visible && (
          <div style={{
            position: 'fixed',
            bottom: 32,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#2d8cff',
            color: '#fff',
            padding: '12px 28px',
            borderRadius: 10,
            fontWeight: 600,
            fontSize: 17,
            boxShadow: '0 2px 14px rgba(45,140,255,0.13)',
            zIndex: 3000,
            opacity: 0.96,
            pointerEvents: 'none',
            transition: 'opacity 0.3s',
          }}>
            {toast.msg}
          </div>
        )}
        <StockDialog
          open={stockDialog.open}
          onClose={handleCloseStockDialog}
          onStock={handleStock}
          characters={characters}
          itemId={stockDialog.itemId ?? 0}
          itemName={stockDialog.itemId ? (itemMap[stockDialog.itemId]?.name ?? '') : ''}
          defaultStock={stockDialog.itemId && selectedCharacterId ? (characters.find(c => c.id === selectedCharacterId)?.shop?.itemCounts?.[stockDialog.itemId] ?? 0) : 0}
        />
        <ShopItemModal
          open={shopItemModal.open}
          onClose={handleCloseShopItemModal}
          onSell={handleShopItemSell}
          onRemove={handleShopItemRemove}
          itemName={shopItemModal.itemId ? (itemMap[shopItemModal.itemId]?.name ?? '') : ''}
          stockCount={shopItemModal.itemId && selectedCharacter ? (selectedCharacter.shop.itemCounts[shopItemModal.itemId] ?? 0) : 0}
          price={shopItemModal.itemId ? itemMap[shopItemModal.itemId]?.current_selling_price : undefined}
        />
        {inventoryContextMenu.open && (
          <InventoryContextMenu
            x={inventoryContextMenu.x}
            y={inventoryContextMenu.y}
            onClose={handleCloseInventoryContextMenu}
            onAdjustStock={handleAdjustStock}
            onPriceHistory={handlePriceHistory}
            onRecordSale={handleRecordSale}
            onDelete={handleDeleteInventoryItem}
          />
        )}
      </main>
    </UISettingsContext.Provider>
  );
}

export default App;
