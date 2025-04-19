import { useState, useEffect, createContext, useContext, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { FuseResult } from "fuse.js";
import Fuse from "fuse.js";
import { Item } from "./types";
import "./App.css";
import './sticky-table.css';
import { Toolbar } from "./Toolbar";
import { Modal } from "./Modal";
import { ContextMenu } from "./ContextMenu";
import { PriceHistoryModal, PriceEntry } from "./PriceHistoryModal";
import { SellModal } from "./SellModal";
import { ItemNameAutocomplete } from "./ItemNameAutocomplete";
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

// Global UI settings context
export interface UISettings {
  round50k: boolean;
  showUnsold: boolean;
  setRound50k: (val: boolean) => void;
  setShowUnsold: (val: boolean) => void;
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
  const [priceHistoryModalOpen, setPriceHistoryModalOpen] = useState(false);
  const [selectedItemForHistory, setSelectedItemForHistory] = useState<Item | null>(null);
  const [round50k, setRound50k] = useState(() => {
    const val = localStorage.getItem("round50k");
    return val ? val === "true" : false;
  });
  const [showUnsold, setShowUnsold] = useState(() => {
    const val = localStorage.getItem("showUnsold");
    return val ? val === "true" : false;
  });
  const [sellModalOpen, setSellModalOpen] = useState(false);
  const [sellItem, setSellItem] = useState<Item | null>(null);
  const [priceStats, setPriceStats] = useState<Record<number, {recent?: PriceEntry, high7d?: PriceEntry}>>({});
  const [sellError, setSellError] = useState<string | null>(null);
  const [showOwnedOnly, setShowOwnedOnly] = useState(false);
  const [sortKey, setSortKey] = useState<'name' | 'current_selling_price' | 'last_sold'>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [ownedItems, setOwnedItems] = useState<Item[]>([]);
  const tableRowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});
  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const [highlightedRow, setHighlightedRow] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string, visible: boolean }>({ msg: '', visible: false });
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tableScrollTop, setTableScrollTop] = useState(0);

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

  // Load saved inventory order from localStorage
  useEffect(() => {
    const savedOrder = localStorage.getItem('inventoryOrder');
    if (savedOrder && items.length > 0) {
      const order = JSON.parse(savedOrder) as number[];
      const owned = items.filter(item => item.owned);
      // Order owned items by saved order, then any new ones alphabetically
      const ordered = [
        ...order
          .map(id => owned.find(i => i.id === id))
          .filter(Boolean) as Item[],
        ...owned.filter(i => !order.includes(i.id)).sort((a, b) => a.name.localeCompare(b.name))
      ];
      setOwnedItems(ordered);
    } else if (items.length > 0) {
      setOwnedItems(items.filter(item => item.owned).sort((a, b) => a.name.localeCompare(b.name)));
    }
  }, [items]);

  // Save inventory order to localStorage whenever it changes
  useEffect(() => {
    if (ownedItems.length > 0) {
      localStorage.setItem('inventoryOrder', JSON.stringify(ownedItems.map(i => i.id)));
    }
  }, [ownedItems]);

  function openAddModal() {
    setEditing(null);
    setName("");
    setPrice("");
    setModalOpen(true);
  }

  function openEditModal(item: Item) {
    setEditing(item);
    setName(item.name);
    setPrice(item.current_selling_price.toString());
    setModalOpen(true);
  }

  async function handleAddOrEdit(e: React.FormEvent) {
    e.preventDefault();
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
    setSelectedItemForHistory(item);
    setPriceHistoryModalOpen(true);
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
      // Optionally log to console for dev
      console.error('Sell error:', err);
    }
  }

  function handleInventoryDragEnd(result: DropResult) {
    if (!result.destination) return;
    // Defensive: ensure ownedItems is up to date and indices are valid
    if (
      !Array.isArray(ownedItems) ||
      result.source.index < 0 ||
      result.source.index >= ownedItems.length ||
      result.destination.index < 0 ||
      result.destination.index > ownedItems.length
    ) {
      // Optionally log or show a warning
      return;
    }
    const reordered = Array.from(ownedItems);
    const [removed] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, removed);
    setOwnedItems(reordered);
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

  return (
    <UISettingsContext.Provider value={{ round50k, showUnsold, setRound50k, setShowUnsold }}>
      <main className="container">
        <Toolbar
          onSetIGN={() => setModalIGN(true)}
          onAbout={() => setModalAbout(true)}
          ign={ign}
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
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 13, color: '#fff', letterSpacing: 0.5 }}>Inventory</div>
            <div
              className="inventory-scrollbar-hide"
              style={{
                overflowY: 'auto',
                height: 'calc(100vh - 70px - 48px)', // 70px header, 48px for inventory title+padding
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <DragDropContext onDragEnd={handleInventoryDragEnd}>
                <Droppable droppableId="inventory-panel">
                  {(provided, snapshot) => (
                    <>
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                      >
                        {ownedItems.map((item, idx) => (
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
                                onClick={() => handleInventoryItemClick(item)}
                              >
                                <span style={{ fontWeight: 500, wordBreak: 'break-word', whiteSpace: 'normal', flex: 1 }}>{item.name}</span>
                                <span style={{ color: '#2d8cff', fontWeight: 600, marginLeft: 10 }}>{item.current_selling_price?.toLocaleString() ?? '-'}</span>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {ownedItems.length === 0 && (
                          <div style={{ color: '#888', fontSize: 15, marginTop: 10 }}>No owned items</div>
                        )}
                      </div>
                      {provided.placeholder}
                    </>
                  )}
                </Droppable>
              </DragDropContext>
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
              <button className="add-btn" onClick={openAddModal}>Add Item</button>
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
              {tableContainerRef.current && tableScrollTop > 0 && (
                <div
                  style={{
                    position: 'fixed',
                    top: tableContainerRef.current.getBoundingClientRect().top,
                    left: tableContainerRef.current.getBoundingClientRect().left,
                    width: tableContainerRef.current.offsetWidth,
                    zIndex: 100,
                    pointerEvents: 'none',
                    transition: 'box-shadow 0.2s',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.13)',
                  }}
                >
                  <table className="styled-table sticky-table" style={{ width: '100%', tableLayout: 'fixed' }}>
                    <thead>
                      <tr>
                        <th>Owned</th>
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
                    <th>Owned</th>
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
                      onClick={() => openHistoryModal(item)}
                      style={{
                        cursor: 'pointer',
                        background: highlightedRow === item.id ? '#2d8cff33' : undefined,
                        transition: 'background 0.3s',
                      }}
                    >
                      <td>
                        <OwnedToggle
                          checked={item.owned ?? false}
                          onChange={async (v) => {
                            await invoke("update_item", {
                              id: item.id,
                              name: item.name,
                              currentSellingPrice: item.current_selling_price,
                              owned: v
                            });
                            fetchItems();
                          }}
                        />
                      </td>
                      <td>{item.name}</td>
                      <td>{item.current_selling_price.toLocaleString()}</td>
                      <td>{daysAgo(priceStats[item.id]?.recent?.date)}</td>
                      <td>{priceStats[item.id]?.recent ? priceStats[item.id]!.recent!.price.toLocaleString() : '-'}</td>
                      <td>{priceStats[item.id]?.high7d ? priceStats[item.id]!.high7d!.price.toLocaleString() : '-'}</td>
                      <td>
                        <button
                          style={{ background: '#4caf50', color: '#fff', fontWeight: 600, border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onClick={e => { e.stopPropagation(); setSellItem(item); setSellModalOpen(true); }}
                          aria-label="Sell"
                        >
                          <img src="/placeholder-sell.png" alt="Sell" style={{ width: 24, height: 24, objectFit: 'contain' }} />
                        </button>
                      </td>
                    </tr>
                  ))}
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
              onClick: () => openEditModal(contextMenu.item!)
            },
            {
              label: "Delete",
              icon: <span aria-hidden="true">🗑</span>,
              onClick: () => handleDelete(contextMenu.item!.id)
            }
          ] : []}
        />
        <PriceHistoryModal
          open={priceHistoryModalOpen}
          onClose={() => setPriceHistoryModalOpen(false)}
          itemId={selectedItemForHistory?.id ?? 0}
          itemName={selectedItemForHistory?.name ?? ""}
          currentPrice={selectedItemForHistory?.current_selling_price ?? 0}
          onSetPrice={(newPrice) => {
            setPrice(newPrice.toString());
            setPriceHistoryModalOpen(false);
            fetchItems();
          }}
        />
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
      </main>
    </UISettingsContext.Provider>
  );
}

export default App;
