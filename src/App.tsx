import { useState, useEffect, useRef, useMemo, useReducer } from "react";
import type { FuseResult } from "fuse.js";
import Fuse from "fuse.js";
import { Item, Character } from "./types";
import type { PriceHistoryEntry } from "./types";
import "./App.css";
import './sticky-table.css';
import './compact.css';
import { Toolbar } from "./Toolbar";
import { Modal } from "./Modal"; // TODO: Use this reusable Modal component for future modals
import { ContextMenu } from "./ContextMenu";
import { PriceHistoryModal } from "./PriceHistoryModal";
import { SellModal } from "./SellModal";
import { ItemNameAutocomplete } from "./ItemNameAutocomplete";
import { SectionHeader } from "./SectionHeader";
import { StockDialog } from "./StockDialog";
import { ShopItemModal } from "./ShopItemModal";
import { InventoryContextMenu } from "./InventoryContextMenu";
import { InventoryPanel } from "./InventoryPanel";
import TitleBar from "./TitleBar";
import React from "react";
import { getCurrentUser } from "./api/auth";
import { getItems, addItem, updateItem, deleteItem } from "./api/items";
import { addPriceHistoryEntry, getPriceHistory, getPriceHistoryForUser, getLatestUserPriceEntry, getLatestSoldEntry, getLatestUserPriceEntriesBatch, getLatestSoldEntriesBatch } from "./api/priceHistory";
import { getIGNForUserId, setIGNForUserId } from "./api/anonLinks";
import LoginScreen from "./components/LoginScreen";
import InventoryTable from "./InventoryTable";
import { Toast } from "./Toast";
import { getPersistentAnonUserById } from "./api/persistentAnon";
import { ensureAnonymousSession } from './api/ensureAnonymousSession';
import { UISettingsContext } from "./contexts/UISettingsContext";
import type { DropResult } from '@hello-pangea/dnd';
import {
  handleStock as makeHandleStock,
  handleDeleteInventoryItem as makeHandleDeleteInventoryItem,
  handleAddCharacter as makeHandleAddCharacter,
  handleCharacterSelect as makeHandleCharacterSelect,
  handleCharacterChange as makeHandleCharacterChange
} from './handlers/characterHandlers';
import {
  handleInventoryContextMenu as makeHandleInventoryContextMenu,
  handleCloseInventoryContextMenu as makeHandleCloseInventoryContextMenu,
  handleAdjustStock as makeHandleAdjustStock,
  handlePriceHistory as makeHandlePriceHistory,
  handleRecordSale as makeHandleRecordSale
} from './handlers/inventoryHandlers';
import { getDb } from './rxdb';

export default function App() {
  // --- All hooks and state declarations ---
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userKarma, setUserKarma] = useState<number | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Item | null>(null);

  // --- Local caching for items ---
  // Try to restore items from localStorage on mount
  useEffect(() => {
    const cached = localStorage.getItem('cachedItems');
    if (cached) {
      try {
        const { data, ts } = JSON.parse(cached);
        // Consider data stale if older than 24 hours
        if (data && ts && Date.now() - ts < 24 * 60 * 60 * 1000) {
          setItems(data);
        }
      } catch {}
    }
  }, []);

  // When items are updated via fetch, update cache
  useEffect(() => {
    if (items && items.length > 0) {
      localStorage.setItem('cachedItems', JSON.stringify({ data: items, ts: Date.now() }));
    }
  }, [items]);

  // --- useReducer for modal state ---
  type ModalState = {
    open: boolean;
    ign: boolean;
    about: boolean;
    editingItem: Item | null;
    ignInput: string;
    name: string;
    price: string;
  };
  const initialModalState: ModalState = {
    open: false,
    ign: false,
    about: false,
    editingItem: null,
    ignInput: "",
    name: "",
    price: "",
  };
  type ModalAction =
    | { type: 'OPEN_EDIT'; item: Item | null }
    | { type: 'OPEN_IGN' }
    | { type: 'OPEN_ABOUT' }
    | { type: 'CLOSE' }
    | { type: 'SET_IGN_INPUT'; value: string }
    | { type: 'SET_NAME'; value: string }
    | { type: 'SET_PRICE'; value: string };
  function modalReducer(state: ModalState, action: ModalAction): ModalState {
    switch (action.type) {
      case 'OPEN_EDIT':
        return { ...state, open: true, editingItem: action.item };
      case 'OPEN_IGN':
        return { ...state, ign: true };
      case 'OPEN_ABOUT':
        return { ...state, about: true };
      case 'CLOSE':
        return { ...initialModalState };
      case 'SET_IGN_INPUT':
        return { ...state, ignInput: action.value };
      case 'SET_NAME':
        return { ...state, name: action.value };
      case 'SET_PRICE':
        return { ...state, price: action.value };
      default:
        return state;
    }
  }
  const [modalState, dispatchModal] = useReducer(modalReducer, initialModalState);

  const [ign, setIGN] = useState<string>("");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: Item | null }>({ x: 0, y: 0, item: null });
  const [priceHistoryModal, setPriceHistoryModal] = useState<{ open: boolean, itemId?: string }>({ open: false });
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([]);
  const [round50k, setRound50k] = useState(() => {
    const val = localStorage.getItem("round50k");
    return val ? val === "true" : false;
  });
  const [showUnsold, setShowUnsold] = useState(() => {
    const val = localStorage.getItem("showUnsold");
    return val ? val === "true" : false;
  });
  const [compactMode, setCompactMode] = useState(() => {
    const val = localStorage.getItem("compactMode");
    if (val !== null) return val === "true";
    return true; // Default to compact mode
  });
  const [sellModalOpen, setSellModalOpen] = useState(false);
  const [sellItem, setSellItem] = useState<Item | null>(null);
  const [priceStats, setPriceStats] = useState<Record<string, { recent?: PriceHistoryEntry }>>({});
  const [sortKey, setSortKey] = useState<'name' | 'current_selling_price' | 'last_sold'>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [characters, setCharacters] = useState<Character[]>(() => {
    const saved = localStorage.getItem('characters');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [];
  });
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(() => {
    const saved = localStorage.getItem('selectedCharacter');
    if (saved) return JSON.parse(saved);
    return null;
  });
  const [addCharacterPrompt, setAddCharacterPrompt] = useState(false);
  const [stockDialog, setStockDialog] = useState<{ open: boolean, itemId?: string }>({ open: false });
  const [shopItemModal, setShopItemModal] = useState<{ open: boolean, itemId?: string }>({ open: false });
  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const [toast, setToast] = useState<{ msg: string, visible: boolean }>({ msg: '', visible: false });
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tableScrollTop, setTableScrollTop] = useState(0);

  const [inventoryContextMenu, setInventoryContextMenu] = useState<{ open: boolean, x: number, y: number, itemId?: string }>({ open: false, x: 0, y: 0 });

  const [userPriceMap, setUserPriceMap] = useState<Map<string, PriceHistoryEntry>>(new Map());

  // Tab state for Inventory sidepanel
  const [inventoryTab, setInventoryTab] = useState<'inventory' | 'ledger'>('inventory');

  // Fetch only the latest user price entry for each item for the "Your Price" cell
  async function fetchUserPrices() {
    const persistentUserId = localStorage.getItem('persistentUserId');
    if (!persistentUserId || !items || items.length === 0) return;
    try {
      // Use new batch fetch function for efficiency
      const map = await getLatestUserPriceEntriesBatch(items.map(item => item.$id), persistentUserId);
      setUserPriceMap(map);
    } catch (err) {
      console.error('[fetchUserPrices] Error fetching latest user prices:', err);
    }
  }

  // Helper to get the last price entry for an item by the current user
  function getLastUserPriceEntry(priceHistory: PriceHistoryEntry[], userId: string): PriceHistoryEntry | undefined {
    // Sort descending by date, filter by author
    return priceHistory
      .filter(e => e.author === userId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  }

  // Utility to refresh user karma from backend
  const refreshUserKarma = async () => {
    const persistentUserId = localStorage.getItem('persistentUserId');
    if (persistentUserId) {
      const userDoc = await getPersistentAnonUserById(persistentUserId);
      if (userDoc && typeof userDoc.karma === 'number') {
        setUserKarma(userDoc.karma);
      } else {
        setUserKarma(0);
      }
    }
  };

  // Helper to update price in localStorage and state
  function updateLocalAndStatePrice(itemId: string, newPrice: number) {
    let localItems = [];
    try { localItems = JSON.parse(localStorage.getItem('localItems') || '[]'); } catch {}
    localItems = localItems.map((i: Item) => i.$id === itemId ? { ...i, current_selling_price: newPrice } : i);
    localStorage.setItem('localItems', JSON.stringify(localItems));
    setItems(prev => prev.map(i => i.$id === itemId ? { ...i, current_selling_price: newPrice } : i));
  }

  // Helper to show toast and auto-dismiss after 1.7s
  function showToast(msg: string) {
    setToast({ msg, visible: true });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast({ msg: '', visible: false }), 1700);
  }

  // --- All useEffect hooks ---
  useEffect(() => {
    ensureAnonymousSession();
  }, []);

  useEffect(() => {
    getCurrentUser().then((user) => {
      if (user) {
        setLoggedIn(true);
        setUserId(user.$id);
      } else {
        setLoggedIn(false);
      }
    });
  }, []);

  // Consolidated: Fetch items when logged in, then fetch user prices when items and userId are ready
  useEffect(() => {
    if (loggedIn === true) {
      fetchItems();
    }
  }, [loggedIn]);

  useEffect(() => {
    if (userId && items.length > 0) {
      refreshUserKarma();
      fetchUserPrices();
    }
  }, [userId, items]);

  useEffect(() => {
    if (loggedIn === true) {
      localStorage.setItem('characters', JSON.stringify(characters));
    }
  }, [characters, loggedIn]);

  useEffect(() => {
    if (loggedIn === true) {
      localStorage.setItem("round50k", String(round50k));
    }
  }, [round50k, loggedIn]);
  useEffect(() => {
    if (loggedIn === true) {
      localStorage.setItem("showUnsold", String(showUnsold));
    }
  }, [showUnsold, loggedIn]);

  useEffect(() => {
    if (loggedIn === true) {
      localStorage.setItem('selectedCharacter', JSON.stringify(selectedCharacter));
    }
  }, [selectedCharacter, loggedIn]);

  useEffect(() => {
    if (loggedIn === true) {
      let cancelled = false;
      async function fetchStats() {
        const stats: Record<string, { recent?: PriceHistoryEntry }> = {};
        // Batch fetch all latest sold entries for all items
        const latestMap = await getLatestSoldEntriesBatch(items.map(item => item.$id));
        items.forEach(item => {
          if (latestMap.has(item.$id)) {
            stats[item.$id] = { recent: latestMap.get(item.$id) };
          } else {
            stats[item.$id] = {};
          }
        });
        if (!cancelled) setPriceStats(stats);
      }
      if (items.length) fetchStats();
      return () => { cancelled = true; };
    }
  }, [items, loggedIn]);

  useEffect(() => {
    if (loggedIn === true) {
      const container = tableContainerRef.current;
      if (!container) return;
      const handleScroll = () => setTableScrollTop(container.scrollTop);
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [loggedIn]);

  useEffect(() => {
    // Always fetch IGN using persistentUserId from localStorage
    const persistentUserId = localStorage.getItem('persistentUserId');
    if (persistentUserId) {
      console.log('[IGN DEBUG] Fetching IGN for persistentUserId:', persistentUserId);
      getIGNForUserId(persistentUserId).then((ign) => {
        console.log('[IGN DEBUG] Result from getIGNForUserId:', ign);
        setIGN(ign || "");
      }).catch(err => {
        console.error('[IGN DEBUG] Error fetching IGN:', err);
      });
    }
  }, [loggedIn]);

  // Restore IGN from anon_links on login
  async function restoreIGN() {
    if (loggedIn === true) {
      const persistentUserId = localStorage.getItem('persistentUserId');
      console.log('[IGN DEBUG] restoreIGN persistentUserId:', persistentUserId);
      if (persistentUserId) {
        try {
          const ignFromDb = await getIGNForUserId(persistentUserId);
          console.log('[IGN DEBUG] restoreIGN ignFromDb:', ignFromDb);
          if (ignFromDb) setIGN(ignFromDb);
        } catch (err) {
          console.error('[IGN DEBUG] restoreIGN error:', err);
        }
      }
    }
  }

  // --- Conditional return for login ---
  if (loggedIn === false) {
    return <LoginScreen onLogin={() => setLoggedIn(true)} />;
  }

  // --- Memoized Fuse instance and filteredItems ---
  const fuse = useMemo(() => new Fuse(items, { keys: ["name", "notes"] }), [items]);
  const filteredItems = useMemo(() => {
    if (!search) return items;
    return fuse.search(search).map(result => result.item);
  }, [search, fuse, items]);

  // Helper for opening the StockDialog
  function handleOpenStockDialog(itemId: string) {
    setStockDialog({ open: true, itemId });
  }

  // --- Rest of App logic and rendering ---
  async function fetchItems() {
    try {
      const result = await getItems();
      // Appwrite returns { documents: [...] }
      const mapped = result.documents.map((doc: any) => ({
        ...doc,
        id: doc.$id,
        current_selling_price: doc.price ?? doc.current_selling_price ?? 0,
        priceHistory: doc.priceHistory || [],
      }));
      setItems(mapped);
      // Update cache immediately after fetch
      localStorage.setItem('cachedItems', JSON.stringify({ data: mapped, ts: Date.now() }));
    } catch (err) {
      showToast(`Failed to fetch items: ${err?.toString() || err}`);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => setToast(t => ({ ...t, visible: false })), 2600);
    }
  }

  async function handleAddOrEdit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (modalState.editingItem) {
        await updateItem(modalState.editingItem.$id, {
          name: modalState.name,
          price: parseFloat(modalState.price),
          notes: modalState.editingItem.notes,
        });
      } else {
        await addItem({
          name: modalState.name,
          price: parseFloat(modalState.price),
          notes: '',
        });
      }
      dispatchModal({ type: 'CLOSE' });
      fetchItems();
    } catch (err: any) {
      showToast(`Error: ${err?.toString() || err}`);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => setToast(t => ({ ...t, visible: false })), 2600);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteItem(id);
      fetchItems();
    } catch (err: any) {
      showToast(`Error: ${err?.toString() || err}`);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => setToast({ msg: '', visible: false }), 1700);
    }
  }

  async function handleSell(item: Item, price: number) {
    const persistentUserId = localStorage.getItem('persistentUserId');
    console.debug('[Sell] handleSell called with:', { item, price, persistentUserId });
    if (!persistentUserId) {
      console.warn('[Sell] persistentUserId missing; aborting sell.');
      return;
    }
    await handleChangePrice(item.$id.toString(), price, undefined, true);
    fetchItems();
    await fetchUserPrices(); // Ensure user price map is refreshed after sale
    await refreshUserKarma(); // Ensure karma is refreshed after sale
  }

  async function handleChangePrice(itemId: string, newPrice: number, notes?: string, isSale?: boolean) {
    const persistentUserId = localStorage.getItem('persistentUserId');
    const priceHistoryEntry = {
      itemId,
      price: newPrice,
      date: new Date().toISOString(),
      author: persistentUserId || '',
      notes,
      ...(isSale ? { sold: true } : {})
    };
    const updateObj = { price: newPrice };
    console.debug('[Sell] handleChangePrice called with:', { itemId, newPrice, notes, isSale });
    console.debug('[Sell] priceHistoryEntry:', priceHistoryEntry);
    console.debug('[Sell] updateObj:', updateObj);
    try {
      await addPriceHistoryEntry(priceHistoryEntry);
      await updateItem(itemId, updateObj);
      updateLocalAndStatePrice(itemId, newPrice);
      showToast("Price updated and history recorded!");
      // Optionally refresh price history modal if open
      if (priceHistoryModal.open && priceHistoryModal.itemId === itemId) {
        fetchAndSetPriceHistory(itemId);
      }
    } catch (e) {
      showToast("Failed to save price. Please try again.");
    }
  }

  async function fetchAndSetPriceHistory(itemId: string, authorIds?: string[]) {
    const res = await getPriceHistory(itemId, authorIds);
    // Appwrite returns res.documents as Document[], which may have extra fields. We'll map it to PriceHistoryEntry[]
    setPriceHistory(res.documents.map(doc => ({
      $id: doc.$id,
      itemId: doc.itemId,
      price: doc.price,
      date: doc.date,
      author: doc.author,
      notes: doc.notes,
      sold: doc.sold,
      downvotes: doc.downvotes ?? [],
    })));
  }

  function handleInventoryDragEnd(result: DropResult) {
    if (!result.destination || result.source.index === result.destination.index) return;
    const destination = result.destination;
    if (!selectedCharacter) return;
    setCharacters(chars => chars.map(c => {
      if (c.id !== selectedCharacter.id) return c;
      const order = Array.from(c.shop.order);
      const [removed] = order.splice(result.source.index, 1);
      order.splice(destination.index, 0, removed);
      // Persist to localStorage for dev/prod parity
      const updated = { ...c, shop: { ...c.shop, order } };
      localStorage.setItem('characters', JSON.stringify(
        chars.map(cc => cc.id === c.id ? updated : cc)
      ));
      // If this character is selected, update selectedCharacter as well
      if (selectedCharacter.id === c.id) {
        localStorage.setItem('selectedCharacter', JSON.stringify(updated));
        setSelectedCharacter(updated);
      }
      return updated;
    }));
  }

  function handleSort(col: 'name' | 'current_selling_price' | 'last_sold') {
    if (sortKey === col) setSortAsc(a => !a);
    else {
      setSortKey(col);
      setSortAsc(true);
    }
  }

  const itemMap = Object.fromEntries(items.map(i => [i.$id, i]));

  const handleCharacterSelect = makeHandleCharacterSelect(characters, setSelectedCharacter);
  const handleCharacterChange = makeHandleCharacterChange(handleCharacterSelect);
  const handleAddCharacter = makeHandleAddCharacter(setCharacters, setSelectedCharacter);

  // Character deletion handler
  function handleDeleteCharacter(id: string) {
    if (!window.confirm('Are you sure you want to delete this character? This cannot be undone.')) return;
    if (selectedCharacter) {
      const allChars = characters.filter(c => c.id !== id);
      setCharacters(allChars);
      console.log('[Delete] setCharacters:', allChars);
      localStorage.setItem('characters', JSON.stringify(allChars));
      // If the deleted character was selected, switch to another or clear selection
      setSelectedCharacter(prev => {
        if (prev?.id === id) {
          const remaining = allChars;
          return remaining.length > 0 ? remaining[0] : null;
        }
        return prev;
      });
    }
  }

  const handleInventoryContextMenu = makeHandleInventoryContextMenu(setInventoryContextMenu);
  const handleCloseInventoryContextMenu = makeHandleCloseInventoryContextMenu(setInventoryContextMenu, inventoryContextMenu);
  const handleAdjustStock = makeHandleAdjustStock(setStockDialog, inventoryContextMenu);
  const handlePriceHistory = makeHandlePriceHistory(setPriceHistoryModal, inventoryContextMenu);
  const handleRecordSale = makeHandleRecordSale(setSellItem, setSellModalOpen, itemMap, inventoryContextMenu);
  const handleDeleteInventoryItem = makeHandleDeleteInventoryItem(setCharacters, selectedCharacter, inventoryContextMenu);
  const handleStock = makeHandleStock(setCharacters, setSelectedCharacter, setStockDialog);

  async function handleCloseShopItemModal() {
    setShopItemModal({ open: false });
  }

  async function handleShopItemSell(count: number) {
    if (!shopItemModal.itemId) return;
    const itemId = shopItemModal.itemId;
    const price = itemMap[itemId]?.current_selling_price;
    if (price === undefined) {
      showToast('No price set for this item.');
      return;
    }
    try {
      await handleSell(itemMap[itemId], price);
      await handleCloseShopItemModal();
    } catch (err) {
      showToast('Failed to sell item. Please try again.');
    }
  }

  function handleShopItemRemove() {
    if (!shopItemModal.itemId) return;
    handleDelete(shopItemModal.itemId.toString());
    handleCloseShopItemModal();
  }

  async function handleSetIGN(e: React.FormEvent) {
    e.preventDefault();
    // Always use persistentUserId from localStorage for IGN
    const persistentUserId = localStorage.getItem('persistentUserId');
    if (!persistentUserId) {
      // Optionally show an error/toast
      showToast('Persistent user ID not found. Please log in again.');
      return;
    }
    await setIGNForUserId(persistentUserId, modalState.ignInput);
    setIGN(modalState.ignInput);
    dispatchModal({ type: 'CLOSE' });
  }

  // Filtering and sorting logic
  const filteredAndSortedItems = filteredItems
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'current_selling_price') {
        const aPrice = a.current_selling_price ?? 0;
        const bPrice = b.current_selling_price ?? 0;
        cmp = aPrice - bPrice;
      }
      else if (sortKey === 'last_sold') {
        const aRecent = priceStats[a.$id]?.recent;
        const aDate = aRecent && aRecent.date ? new Date(aRecent.date).getTime() : 0;
        const bRecent = priceStats[b.$id]?.recent;
        const bDate = bRecent && bRecent.date ? new Date(bRecent.date).getTime() : 0;
        cmp = aDate - bDate;
      }
      return sortAsc ? cmp : -cmp;
    });

  return (
    <UISettingsContext.Provider value={{ round50k, showUnsold, setRound50k, setShowUnsold, compactMode, setCompactMode }}>
      <TitleBar />
      <Toolbar
        onSetIGN={() => dispatchModal({ type: 'OPEN_IGN' })}
        onAbout={() => dispatchModal({ type: 'OPEN_ABOUT' })}
        ign={ign}
        compactMode={compactMode}
        setCompactMode={setCompactMode}
        userKarma={userKarma}
      />
      {/* Removed duplicate karma-toolbar-display, as it is now handled in Toolbar */}
      <main className={`container${compactMode ? ' compact' : ''}`} style={{ paddingTop: 0, paddingLeft: 16 }}>
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
        <div style={{ display: 'flex', flexDirection: 'row', height: '100vh', minHeight: 0 }}>
          {/* Inventory Sidepanel with Tabs */}
          <aside className="inventory-panel-scroll" style={{
            width: 303,
            minWidth: 230,
            maxWidth: 340,
            background: '#232323',
            borderRight: '1.5px solid #333',
            padding: 0,
            overflow: 'hidden', // revert to hidden to avoid overhang
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            boxSizing: 'border-box',
            position: 'relative',
          }}>
            {/* Tab Buttons */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid #333',
              background: '#232323',
              width: '100%',
              boxSizing: 'border-box',
              margin: 0,
              padding: 0,
              position: 'relative',
              zIndex: 2,
              overflow: 'hidden', // revert to hidden to avoid overhang
            }}>
              <button
                style={{
                  flex: 1,
                  padding: '12px 0 10px 0',
                  background: inventoryTab === 'inventory' ? '#181818' : 'transparent',
                  color: inventoryTab === 'inventory' ? '#fff' : '#aaa',
                  fontWeight: 700,
                  fontSize: 15,
                  border: 'none',
                  borderBottom: inventoryTab === 'inventory' ? '2px solid #2d8cff' : 'none',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'background .15s, color .15s',
                  width: '100%',
                  minWidth: 0,
                  boxSizing: 'border-box',
                  margin: 0,
                  borderRadius: 0,
                  overflow: 'hidden', // revert to hidden to avoid overhang
                }}
                onClick={() => setInventoryTab('inventory')}
              >Inventory</button>
              <button
                style={{
                  flex: 1,
                  padding: '12px 0 10px 0',
                  background: inventoryTab === 'ledger' ? '#181818' : 'transparent',
                  color: inventoryTab === 'ledger' ? '#fff' : '#aaa',
                  fontWeight: 700,
                  fontSize: 15,
                  border: 'none',
                  borderBottom: inventoryTab === 'ledger' ? '2px solid #2d8cff' : 'none',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'background .15s, color .15s',
                  width: '100%',
                  minWidth: 0,
                  boxSizing: 'border-box',
                  margin: 0,
                  borderRadius: 0,
                  overflow: 'hidden', // revert to hidden to avoid overhang
                }}
                onClick={() => setInventoryTab('ledger')}
              >Ledger</button>
            </div>
            {/* Tab Content */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
              {inventoryTab === 'inventory' && (
                <InventoryPanel
                  characters={characters}
                  selectedCharacterId={selectedCharacter ? selectedCharacter.id : null}
                  setSelectedCharacterId={id => {
                    const found = characters.find(c => c.id === id) || null;
                    setSelectedCharacter(found);
                    localStorage.setItem('selectedCharacter', JSON.stringify(found));
                  }}
                  handleAddCharacter={handleAddCharacter}
                  handleDeleteCharacter={handleDeleteCharacter}
                  handleInventoryDragEnd={handleInventoryDragEnd}
                  itemMap={itemMap}
                  userPriceMap={userPriceMap}
                  setToast={setToast}
                  toastTimeoutRef={toastTimeoutRef}
                  setInventoryContextMenu={setInventoryContextMenu}
                  getLastUserPriceEntry={getLastUserPriceEntry}
                  selectedCharacter={selectedCharacter}
                  handleOpenStockDialog={handleOpenStockDialog}
                />
              )}
              {inventoryTab === 'ledger' && (
                <div style={{ color: '#aaa', padding: 24, fontSize: 16, textAlign: 'center' }}>
                  Ledger functionality coming soon.
                </div>
              )}
            </div>
          </aside>
          {/* Main Content */}
          <div style={{ flex: 1, minWidth: 0, paddingLeft: 14 /* matches inventory panel's right padding */ }}>
            <InventoryTable
              filteredItems={filteredItems}
              search={search}
              setSearch={setSearch}
              setModalOpen={() => dispatchModal({ type: 'OPEN_EDIT', item: null })}
              tableContainerRef={tableContainerRef}
              tableScrollTop={tableScrollTop}
              sortKey={sortKey}
              sortAsc={sortAsc}
              handleSort={handleSort}
              itemMap={itemMap}
              selectedCharacter={selectedCharacter}
              userPriceMap={userPriceMap}
              priceStats={priceStats}
              handleInventoryContextMenu={handleInventoryContextMenu}
              highlightedRow={null}
              handleOpenStockDialog={itemId => setStockDialog({ open: true, itemId })}
              setSellItem={setSellItem}
              setSellModalOpen={setSellModalOpen}
              openHistoryModal={item => setPriceHistoryModal({ open: true, itemId: item.$id })}
            />
          </div>
        </div>
        <Toast msg={toast.msg} visible={toast.visible} />
        <Modal open={modalState.open} onClose={() => dispatchModal({ type: 'CLOSE' })}>
          <h2>{modalState.editingItem ? "Edit Item" : "Add Item"}</h2>
          <form onSubmit={handleAddOrEdit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <ItemNameAutocomplete
              value={modalState.name}
              onChange={(value) => dispatchModal({ type: 'SET_NAME', value })}
              placeholder="Item name"
              required
              autoFocus
              existingItems={items.map(i => i.name)}
              style={{ width: "100%", boxSizing: "border-box" }}
            />
            <input
              value={modalState.price}
              onChange={(e) => dispatchModal({ type: 'SET_PRICE', value: e.target.value })}
              placeholder="Current Price"
              type="number"
              min="0"
              step="any"
              required
              style={{ width: "100%", boxSizing: "border-box" }}
            />
            {items.some(i => i.name.trim().toLowerCase() === modalState.name.trim().toLowerCase()) && !modalState.editingItem && (
              <div style={{ color: '#2d8cff', fontWeight: 500, fontSize: 15, marginTop: -6 }}>
                This item already exists and cannot be added again.
              </div>
            )}
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button type="submit" disabled={items.some(i => i.name.trim().toLowerCase() === modalState.name.trim().toLowerCase()) && !modalState.editingItem}>Save</button>
              <button type="button" onClick={() => dispatchModal({ type: 'CLOSE' })}>Cancel</button>
            </div>
          </form>
        </Modal>
        <Modal open={modalState.ign} onClose={() => dispatchModal({ type: 'CLOSE' })}>
          <h2>Set In-Game Name</h2>
          <form onSubmit={handleSetIGN} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              value={modalState.ignInput}
              onChange={(e) => dispatchModal({ type: 'SET_IGN_INPUT', value: e.target.value })}
              placeholder="Enter your IGN"
              autoFocus
            />
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button type="submit">Save</button>
              <button type="button" onClick={() => dispatchModal({ type: 'CLOSE' })}>Cancel</button>
            </div>
          </form>
        </Modal>
        <Modal open={modalState.about} onClose={() => dispatchModal({ type: 'CLOSE' })}>
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
              onClick: () => dispatchModal({ type: 'OPEN_EDIT', item: contextMenu.item! })
            },
            {
              label: "Remove from Store",
              icon: <span aria-hidden="true">🗑</span>,
              onClick: handleDeleteInventoryItem
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
            itemId={priceHistoryModal.itemId ?? ''}
            itemName={itemMap[priceHistoryModal.itemId]?.name || ''}
            currentPrice={userPriceMap.has(priceHistoryModal.itemId) ? userPriceMap.get(priceHistoryModal.itemId)?.price ?? 0 : itemMap[priceHistoryModal.itemId]?.current_selling_price ?? 0}
            onSetPrice={(newPrice: number) => {
              updateLocalAndStatePrice(priceHistoryModal.itemId ?? '', newPrice);
              showToast("Price updated and history recorded!");
            }}
          />
        )}
        <SellModal
          open={sellModalOpen}
          onClose={() => { setSellModalOpen(false); setSellItem(null); }}
          onSell={(amt, price) => {
            if (sellItem) handleSell(sellItem, price);
            refreshUserKarma();
            setSellModalOpen(false);
            setSellItem(null);
          }}
          itemName={sellItem?.name || ''}
          userPrice={sellItem && userPriceMap.has(sellItem.$id) ? userPriceMap.get(sellItem.$id)?.price : undefined}
          defaultPrice={sellItem?.current_selling_price}
        />
        {stockDialog.open && stockDialog.itemId && (
          <StockDialog
            open={stockDialog.open}
            onClose={() => setStockDialog({ open: false, itemId: undefined })}
            characters={characters}
            itemName={itemMap[stockDialog.itemId ?? '']?.name ?? ''}
            itemId={stockDialog.itemId ?? ''}
            defaultStock={selectedCharacter ? (selectedCharacter.shop.itemCounts[stockDialog.itemId ?? ''] ?? 0) : 0}
            onStock={handleStock}
          />
        )}
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
            deleteLabel="Remove from Store"
          />
        )}
      </main>
    </UISettingsContext.Provider>
  );
}
