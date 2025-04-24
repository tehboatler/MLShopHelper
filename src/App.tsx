import { useState, useEffect, useRef, useMemo, useReducer } from "react";
// import type { FuseResult } from "fuse.js";
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
import { NameInputModal } from "./NameInputModal";
// import { SectionHeader } from "./SectionHeader";
import { StockModal } from "./StockModal";
import { ShopItemModal } from "./ShopItemModal";
import { InventoryContextMenu } from "./InventoryContextMenu";
import { InventoryPanel } from "./InventoryPanel";
import TitleBar from "./TitleBar";
import React from "react";
import { getCurrentUser } from "./api/auth";
import { getIGNForUserId, setIGNForUserId } from "./api/anonLinks";
import LoginScreen from "./components/LoginScreen";
import InventoryTable from "./InventoryTable";
import { Toast } from "./Toast";
import { getPersistentAnonUserById } from "./api/persistentAnon";
import { UISettingsContext } from "./contexts/UISettingsContext";
import type { DropResult } from '@hello-pangea/dnd';
import {
  handleDeleteInventoryItem as makeHandleDeleteInventoryItem,
  // handleAddCharacter as makeHandleAddCharacter,
  // handleCharacterSelect as makeHandleCharacterSelect,
  // handleCharacterChange as makeHandleCharacterChange
} from './handlers/characterHandlers';
import {
  handleInventoryContextMenu as makeHandleInventoryContextMenu,
  handleCloseInventoryContextMenu as makeHandleCloseInventoryContextMenu,
  handleAdjustStock as makeHandleAdjustStock,
  handlePriceHistory as makeHandlePriceHistory,
  handleRecordSale as makeHandleRecordSale
} from './handlers/inventoryHandlers';
// import { getDb } from './rxdb';
import { getLatestSoldEntriesBatchRX } from './priceHistoryRXDB';
import Ledger from "./Ledger";
import AddEditItemModal from "./AddEditItemModal";
import { useRxdbItems } from './hooks/useRxdbItems';
import { addPriceHistoryEntry } from './api/priceHistory';
import { addPriceHistoryEntryRX } from './priceHistoryRXDB';
import { updateItem } from './api/items';
// import { debugAppwriteSession } from './debugAppwriteSession';
import { subscribeToAppwriteRealtimeForItems, replicateInvitesAppwrite } from './rxdb';
import { closeDb, getDb } from './rxdb';
import { useRxdbPriceHistory } from './hooks/useRxdbPriceHistory';
import { SaleWarningModal } from "./SaleWarningModal";
import { addItem } from './api/items';
import VersionGatekeeper from './VersionGatekeeper';
import { InvitesProvider } from './providers/InvitesProvider';
import { useUserKarma } from './hooks/useUserKarma';
import { useUserInvites } from './hooks/useUserInvites';
import { useCreateInvite } from './hooks/useCreateInvite';
import { InvitesModal } from './InvitesModal';

export default function App() {
  // --- All hooks and state declarations ---
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [dbReady, setDbReady] = useState(false);
  // Debug: Track changes to dbReady, loggedIn, userId
  useEffect(() => {
    console.debug('[DEBUG] dbReady changed:', dbReady);
  }, [dbReady]);
  useEffect(() => {
    console.debug('[DEBUG] loggedIn changed:', loggedIn);
  }, [loggedIn]);
  useEffect(() => {
    console.debug('[DEBUG] userId changed:', userId);
  }, [userId]);
  // Only fetch RxDB items if authenticated
  const [items, ___] = useRxdbItems(!!loggedIn && dbReady);

  // --- RxDB price history live subscription ---
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [priceHistoryData, __] = useRxdbPriceHistory(
    !!loggedIn && dbReady, // authentication guard as first argument
    [priceHistory, setPriceHistory] // external state as second argument
  );
  const [saleWarning, setSaleWarning] = useState<{ open: boolean, itemId?: string, itemName?: string, price?: number, notes?: string } | null>(null);

  // --- Persistent User ID state ---
  const [persistentUserId, setPersistentUserId] = useState(() => localStorage.getItem('persistentUserId'));

  // Update persistentUserId whenever login state changes
  useEffect(() => {
    const id = localStorage.getItem('persistentUserId');
    setPersistentUserId(id);
    console.debug('[App] persistentUserId updated from localStorage:', id, typeof id);
  }, [loggedIn]);

  // --- Karma: Use live hook so Toolbar always updates ---
  const { karma: userKarma, loading: _ } = useUserKarma(persistentUserId || '');

  // --- User Price Map Memo ---
  const userPriceMap = useMemo(() => {
    if (!dbReady || !persistentUserId) {
      console.debug('[App] userPriceMap: Not ready (dbReady:', dbReady, ', persistentUserId:', persistentUserId, ')');
      return new Map();
    }
    // Debug: Print a sample of priceHistory entries
    console.debug('[App] priceHistory sample (first 5):', priceHistory.slice(0, 5));
    if (priceHistory.length > 0) {
      for (let i = 0; i < Math.min(5, priceHistory.length); i++) {
        const e = priceHistory[i];
        console.debug(`[App] priceHistory[${i}]`, {
          id: e.id,
          itemId: e.itemId,
          author: e.author,
          authorType: typeof e.author,
          persistentUserId,
          persistentUserIdType: typeof persistentUserId
        });
      }
    }
    // Only include price history for this user
    const filtered = priceHistory.filter(e => e.author === persistentUserId);
    // Sort by date descending (latest first)
    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const map = new Map();
    filtered.forEach(entry => {
      // Prefer itemId, fallback to id if needed
      const key = entry.itemId || entry.id;
      if (key && !map.has(key)) map.set(key, entry);
    });
    console.debug('[App] userPriceMap recomputed:', {
      persistentUserId,
      filteredCount: filtered.length,
      mapSize: map.size,
      keys: Array.from(map.keys()).slice(0, 5),
      sampleEntry: filtered[0] || null
    });
    return map;
  }, [dbReady, priceHistory, persistentUserId]);

  useEffect(() => {
    console.log('[DEBUG] RxDB items:', items);
    if (Array.isArray(items) && items.length > 0) {
      items.forEach((item, idx) => {
        console.log(`[DEBUG] Item[${idx}]:`, item);
      });
    }
  }, [items]);

  useEffect(() => {
    if (dbReady) {
      subscribeToAppwriteRealtimeForItems();
    }
  }, [dbReady]);

  useEffect(() => {
    getDb().then(db => {
      replicateInvitesAppwrite(db);
    });
  }, []);

  // --- Ensure itemStats are updated on app start and refresh ---
  useEffect(() => {
    if (loggedIn === true && dbReady) {
      import('./rxdb').then(m => m.updateAllItemStats());
    }
  }, [loggedIn, dbReady, items]);

  const [search, setSearch] = useState("");
  // const [editing, setEditing] = useState<Item | null>(null);

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
  // const [addCharName, setAddCharName] = useState("");
  const [stockDialog, setStockDialog] = useState<{ open: boolean, itemId?: string }>({ open: false });
  const [shopItemModal, setShopItemModal] = useState<{ open: boolean, itemId?: string }>({ open: false });
  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const [toast, setToast] = useState<{ msg: string, visible: boolean }>({ msg: '', visible: false });
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tableScrollTop, setTableScrollTop] = useState(0);

  const [inventoryContextMenu, setInventoryContextMenu] = useState<{ open: boolean, x: number, y: number, itemId?: string }>({ open: false, x: 0, y: 0 });

  // Tab state for Inventory sidepanel
  const [inventoryTab, setInventoryTab] = useState<'inventory' | 'ledger'>('inventory');

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
        // setUserKarma(userDoc.karma); // REMOVE this line
      } else {
        // setUserKarma(0); // REMOVE this line
      }
    }
  };

  // Helper to update price in localStorage and state
  function updateLocalAndStatePrice(itemId: string, newPrice: number) {
    let localItems = [];
    try { localItems = JSON.parse(localStorage.getItem('localItems') || '[]'); } catch {}
    localItems = localItems.map((i: Item) => i.$id === itemId ? { ...i, current_selling_price: newPrice } : i);
    localStorage.setItem('localItems', JSON.stringify(localItems));
    // setItems(prev => prev.map(i => i.$id === itemId ? { ...i, current_selling_price: newPrice } : i));
  }

  // Helper to show toast and auto-dismiss after 1.7s
  function showToast(msg: string) {
    setToast({ msg, visible: true });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast({ msg: '', visible: false }), 1700);
  }

  // --- Utility: Appwrite-compliant ID generator ---
  function makeAppwriteId(itemId: string, userId: string) {
    const safeDate = new Date().toISOString().replace(/[^a-zA-Z0-9]/g, '').slice(0, 14);
    return `${itemId.slice(0, 12)}-${safeDate}-${userId.slice(0, 8)}`.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 36);
  }

  // --- All useEffect hooks ---

  // Move checkAuth outside useEffect so it can be called after login
  async function checkAuth() {
    try {
      const user = await getCurrentUser(); // returns null if not authenticated
      if (user) {
        setLoggedIn(true);
        setUserId(user.$id);
        // Ensure persistentUserId is set in both localStorage and state
        let persistentUserId = localStorage.getItem('persistentUserId');
        if (!persistentUserId || persistentUserId !== user.$id) {
          localStorage.setItem('persistentUserId', user.$id);
          persistentUserId = user.$id;
        }
        setPersistentUserId(persistentUserId);
      } else {
        setLoggedIn(false);
        setUserId(null);
        setPersistentUserId(null);
      }
    } catch {
      setLoggedIn(false);
      setUserId(null);
      setPersistentUserId(null);
      // Optionally clear zombie session/localStorage here
    }
  }

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (userId && items.length > 0) {
      refreshUserKarma();
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
    async function fetchStats() {
      const stats: Record<string, { recent?: PriceHistoryEntry }> = {};
      // Batch fetch all latest sold entries for all items
      const latestMap = await getLatestSoldEntriesBatchRX(userId!);
      items.forEach(item => {
        if (Object.prototype.hasOwnProperty.call(latestMap, item.$id)) {
          stats[item.$id] = { recent: latestMap[item.$id] };
        } else {
          stats[item.$id] = {};
        }
      });
      setPriceStats(stats);
    }
    if (items.length) fetchStats();
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
  // async function restoreIGN() {
  //   if (loggedIn === true) {
  //     const persistentUserId = localStorage.getItem('persistentUserId');
  //     console.log('[IGN DEBUG] restoreIGN persistentUserId:', persistentUserId);
  //     if (persistentUserId) {
  //       try {
  //         const ignFromDb = await getIGNForUserId(persistentUserId);
  //         console.log('[IGN DEBUG] restoreIGN ignFromDb:', ignFromDb);
  //         if (ignFromDb) setIGN(ignFromDb);
  //       } catch (err) {
  //         console.error('[IGN DEBUG] restoreIGN error:', err);
  //       }
  //     }
  //   }
  // }

  // Clear Appwrite session cookies when showing login screen
  useEffect(() => {
    if (loggedIn === false) {
      import('./api/auth').then(({ logout }) => logout());
    }
  }, [loggedIn]);

  // Reinitialize RxDB after login/logout
  useEffect(() => {
    let cancelled = false;
    async function setupDb() {
      await closeDb(); // Always close previous instance
      if (loggedIn) {
        await getDb();
        if (!cancelled) setDbReady(true);
      } else {
        setDbReady(false);
      }
    }
    setupDb();
    return () => { cancelled = true; };
  }, [loggedIn]);

  // --- Friends Filtering State ---
  const [filterByFriends, setFilterByFriends] = useState(false);
  const [friendsWhitelist, setFriendsWhitelist] = useState<string[]>([]);

  // Fetch the user's whitelist (friends) and include self
  useEffect(() => {
    async function fetchFriends() {
      const persistentUserId = localStorage.getItem('persistentUserId');
      if (!persistentUserId) return;
      try {
        const { getAnonLinkDocByUserId } = await import('./api/anonLinks');
        const doc = await getAnonLinkDocByUserId(persistentUserId);
        let whitelist = Array.isArray(doc?.whitelist) ? doc.whitelist : [];
        if (!whitelist.includes(persistentUserId)) {
          whitelist = [persistentUserId, ...whitelist];
        }
        setFriendsWhitelist(whitelist);
      } catch (err) {
        setFriendsWhitelist([persistentUserId]);
      }
    }
    if (loggedIn === true) fetchFriends();
  }, [loggedIn]);

  // --- Memoized Fuse instance and filteredItems ---
  const fuse = useMemo(() => new Fuse(items, { keys: ["name", "notes"] }), [items]);
  const filteredItems = useMemo(() => {
    if (!search) return items.filter(Boolean);
    return fuse.search(search).map(result => result.item).filter(Boolean);
  }, [search, fuse, items]);

  // Helper for opening the StockDialog
  function handleOpenStockDialog(itemId: string) {
    setStockDialog({ open: true, itemId });
  }

  // --- Helper to open Price History Modal on left-click ---
  const openHistoryModal = (item: Item) => {
    setPriceHistoryModal({ open: true, itemId: item.$id });
  };

  // --- Debug: Log priceHistory emissions and authors ---
  useEffect(() => {
    console.debug('[App] priceHistory changed, length:', priceHistory.length);
    if (priceHistory.length > 0) {
      console.debug('[App] priceHistory first 5:', priceHistory.slice(0, 5));
      const authors = Array.from(new Set(priceHistory.map(e => e.author)));
      console.debug('[App] unique authors in priceHistory:', authors);
      if (persistentUserId) {
        console.debug('[App] persistentUserId:', persistentUserId, 'type:', typeof persistentUserId);
        const matches = priceHistory.filter(e => e.author === persistentUserId);
        console.debug('[App] priceHistory entries matching persistentUserId:', matches.length, matches.slice(0, 3));
      }
    }
  }, [priceHistory, persistentUserId]);

  // --- Invites Modal State ---
  const [invitesModalOpen, setInvitesModalOpen] = useState(false);
  const { invites, loading: invitesLoading } = useUserInvites(persistentUserId || '');
  const { create: createInvite, loading: createInviteLoading, error: createInviteError } = useCreateInvite(persistentUserId || '');

  // --- Rest of App logic and rendering ---
  async function handleAddOrEdit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (modalState.editingItem) {
        // await updateItem(modalState.editingItem.$id, {
        //   name: modalState.name,
        //   price: parseFloat(modalState.price),
        //   notes: modalState.editingItem.notes,
        // });
      } else {
        // Add item to Appwrite via RxDB (replication will sync)
        const result = await addItem({
          name: modalState.name,
          price: parseFloat(modalState.price),
          notes: '',
        });
        console.debug('[AddItem] Added item result:', result);
      }
      dispatchModal({ type: 'CLOSE' });
      // Optionally refresh UI if needed
      // fetchItems();
    } catch (err: any) {
      console.error('[AddItem] Error:', err);
      showToast(`Error: ${err?.toString() || err}`);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => setToast(t => ({ ...t, visible: false })), 2600);
    }
  }

  async function handleDelete(_: string) {
    try {
      // await deleteItem(id);
      // fetchItems();
    } catch (err: any) {
      showToast(`Error: ${err?.toString() || err}`);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => setToast({ msg: '', visible: false }), 1700);
    }
  }

  async function handleSell(item: Item, price: number) {
    const persistentUserId = localStorage.getItem('persistentUserId');
    if (!persistentUserId) {
      console.warn('[Sell] persistentUserId missing; aborting sell.');
      return;
    }
    // Check if user has already logged a sale for this item today
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const alreadyLogged = priceHistory.some(e => e.author === persistentUserId && e.itemId === item.$id && e.sold && e.date.slice(0, 10) === today);
    if (!alreadyLogged) {
      setSaleWarning({ open: true, itemId: item.$id, itemName: item.name, price });
      return;
    }
    // If already logged, proceed without public log (isSale = false)
    await handleChangePrice(item.$id.toString(), price, undefined, false, item.name);
    refreshUserKarma();
  }

  async function handleChangePrice(itemId: string, newPrice: number, notes?: string, isSale?: boolean, itemName?: string) {
    const persistentUserId = localStorage.getItem('persistentUserId');
    // Fetch IGN for the user
    let author_ign = undefined;
    try {
      if (persistentUserId) {
        // Dynamic import to avoid circular deps if any
        const { getIGNForUserId } = await import('./api/anonLinks');
        author_ign = await getIGNForUserId(persistentUserId);
      }
    } catch (err) {
      console.warn('[handleChangePrice] Failed to fetch IGN:', err);
    }
    const id = makeAppwriteId(itemId, persistentUserId || '');
    const priceHistoryEntry = {
      id,
      itemId,
      price: newPrice,
      date: new Date().toISOString(),
      author: persistentUserId || '',
      ...(author_ign ? { author_ign } : {}),
      notes,
      ...(isSale ? { sold: true } : {}),
      ...(itemName ? { item_name: itemName } : {})
    };
    const updateObj = { price: newPrice };
    console.debug('[Sell] handleChangePrice called with:', { itemId, newPrice, notes, isSale, itemName });
    console.debug('[Sell] priceHistoryEntry:', priceHistoryEntry);
    console.debug('[Sell] updateObj:', updateObj);
    try {
      await addPriceHistoryEntry(priceHistoryEntry); // Remote (Appwrite)
      // Only keep properties allowed by RxDB schema, and provide defaults as needed
      const rxdbEntry = {
        id: priceHistoryEntry.id,
        itemId: priceHistoryEntry.itemId,
        price: priceHistoryEntry.price,
        date: priceHistoryEntry.date,
        author: priceHistoryEntry.author,
        author_ign: priceHistoryEntry.author_ign ?? null,
        downvotes: [], // Always start as empty array for new entries
        item_name: priceHistoryEntry.item_name ?? null,
        sold: typeof priceHistoryEntry.sold === 'boolean' ? priceHistoryEntry.sold : false
      };
      await addPriceHistoryEntryRX(rxdbEntry); // Local RxDB for instant UI update
      await updateItem(itemId, updateObj);
      updateLocalAndStatePrice(itemId, newPrice);
      // --- PATCH: Force refresh priceHistory state after local RXDB write ---
      setPriceHistory(prev => [...prev, rxdbEntry]);
      showToast("Price updated and history recorded!");
    } catch (e) {
      // Improved error logging for debugging
      console.error("Error in handleChangePrice:", e);
      if (e instanceof Error) {
        showToast(`Failed to save price: ${e.message}`);
      } else {
        showToast("Failed to save price. Please try again.");
      }
    }
  }

  async function confirmSaleWarning() {
    if (!saleWarning?.itemId || !saleWarning.price) return;
    await handleChangePrice(saleWarning.itemId, saleWarning.price, undefined, true, saleWarning.itemName);
    refreshUserKarma();
    setSaleWarning(null);
  }

  function cancelSaleWarning() {
    setSaleWarning(null);
  }

  function handleInventoryDragEnd(result: DropResult) {
    if (!result.destination || result.source.index === result.destination.index) return;
    const destination = result.destination;
    if (!selectedCharacter) return;
    setCharacters(chars => {
      const updated = chars.map(c => {
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
      });
      return updated;
    });
  }

  // function handleSort(col: 'name' | 'current_selling_price' | 'last_sold') {
  //   if (sortKey === col) setSortAsc(a => !a);
  //   else {
  //     setSortKey(col);
  //     setSortAsc(true);
  //   }
  // }

  const itemMap = Object.fromEntries(items.map(i => [i.$id, i]));

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

  // --- Add Character Handler ---
  const handleAddCharacter = (char: Character) => {
    setCharacters(chars => {
      const updated = [...chars, char];
      localStorage.setItem('characters', JSON.stringify(updated));
      return updated;
    });
    setSelectedCharacter(char);
    localStorage.setItem('selectedCharacter', JSON.stringify(char));
  };

  async function handleCloseShopItemModal() {
    setShopItemModal({ open: false });
  }

  async function handleShopItemSell(_: number) {
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
  // const filteredAndSortedItems = filteredItems
  //   .sort((a, b) => {
  //     let cmp = 0;
  //     if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
  //     else if (sortKey === 'current_selling_price') {
  //       const aPrice = a.current_selling_price ?? 0;
  //       const bPrice = b.current_selling_price ?? 0;
  //       cmp = aPrice - bPrice;
  //     }
  //     else if (sortKey === 'last_sold') {
  //       const aRecent = priceStats[a.$id]?.recent;
  //       const aDate = aRecent && aRecent.date ? new Date(aRecent.date).getTime() : 0;
  //       const bRecent = priceStats[b.$id]?.recent;
  //       const bDate = bRecent && bRecent.date ? new Date(bRecent.date).getTime() : 0;
  //       cmp = aDate - bDate;
  //     }
  //     return sortAsc ? cmp : -cmp;
  //   });

  // --- Conditional returns for authentication state ---
  if (loggedIn === null) {
    // Still checking auth, render nothing or a loading spinner
    return null;
  }
  // if (loggedIn && !dbReady) {
  //   return <div style={{padding: 40, textAlign: 'center', color: '#bbb', fontSize: 20}}>Loading database…</div>;
  // }
  // if (itemsLoading) {
  //   return <div style={{padding: 40, textAlign: 'center', color: '#bbb', fontSize: 20}}>Loading items…</div>;
  // }
  if (loggedIn === false) {
    return <LoginScreen onLogin={checkAuth} />;
  }

  function handleRemoveFromStore(characterId: string, itemId: string) {
    setCharacters(chars => {
      const updated = chars.map(c => {
        if (c.id !== characterId) return c;
        const counts = { ...(c.shop.itemCounts || {}) };
        delete counts[itemId];
        const order = Array.isArray(c.shop.order)
          ? c.shop.order.filter(id => id !== itemId)
          : [];
        return { ...c, shop: { itemCounts: counts, order } };
      });
      localStorage.setItem('characters', JSON.stringify(updated));
      const updatedChar = updated.find(c => c.id === characterId);
      if (updatedChar) setSelectedCharacter(updatedChar);
      setToast({
        msg: `${itemMap[itemId]?.name ?? ''} removed from store for ${updatedChar?.name ?? ''}.`,
        visible: true,
      });
      return updated;
    });
    setStockDialog({ open: false, itemId: undefined });
  }

  function handleInventoryItemSelect(itemName: string) {
    setSearch(itemName);
  }

  return (
    <InvitesProvider userId={persistentUserId || ''} userKarma={userKarma}>
      <VersionGatekeeper />
      <UISettingsContext.Provider value={{ round50k, showUnsold, setRound50k, setShowUnsold, compactMode, setCompactMode }}>
        <TitleBar />
        <Toolbar
          onSetIGN={() => dispatchModal({ type: 'OPEN_IGN' })}
          onAbout={() => dispatchModal({ type: 'OPEN_ABOUT' })}
          ign={ign}
          compactMode={compactMode}
          setCompactMode={setCompactMode}
          userKarma={userKarma}
          filterByFriends={filterByFriends}
          setFilterByFriends={setFilterByFriends}
          onShowInvites={() => setInvitesModalOpen(true)}
        />
        {/* Removed duplicate karma-toolbar-display, as it is now handled in Toolbar */}
        <main className={`container${compactMode ? ' compact' : ''}`} style={{ paddingTop: 0, paddingLeft: 0 }}>
          {addCharacterPrompt && (
            <NameInputModal
              open={addCharacterPrompt}
              onClose={() => setAddCharacterPrompt(false)}
              onSubmit={name => {
                handleAddCharacter({ id: crypto.randomUUID(), name, shop: { itemCounts: {}, order: [] } });
                setAddCharacterPrompt(false);
              }}
              title="Add New Character"
              label="Character Name"
              confirmText="Add"
            />
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
                    onRemoveFromStore={handleRemoveFromStore}
                    onItemSelected={handleInventoryItemSelect}
                  />
                )}
                {inventoryTab === 'ledger' && (
                  <Ledger />
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
                itemMap={itemMap}
                selectedCharacter={selectedCharacter}
                userPriceMap={userPriceMap}
                priceStats={priceStats}
                handleInventoryContextMenu={handleInventoryContextMenu}
                highlightedRow={null}
                handleOpenStockDialog={itemId => setStockDialog({ open: true, itemId })}
                setSellItem={setSellItem}
                setSellModalOpen={setSellModalOpen}
                openHistoryModal={openHistoryModal}
                filterByFriends={filterByFriends}
                friendsWhitelist={friendsWhitelist}
              />
            </div>
          </div>
          <Toast msg={toast.msg} visible={toast.visible} />
          <AddEditItemModal
            open={modalState.open}
            modalState={modalState}
            dispatchModal={dispatchModal}
            items={items}
            handleAddOrEdit={handleAddOrEdit}
          />
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
              filterByFriends={filterByFriends}
              friendsWhitelist={friendsWhitelist}
              itemStats={itemMap[priceHistoryModal.itemId] ? {
                p0: itemMap[priceHistoryModal.itemId].p0,
                p25: itemMap[priceHistoryModal.itemId].p25,
                p50: itemMap[priceHistoryModal.itemId].p50,
                p75: itemMap[priceHistoryModal.itemId].p75,
                p100: itemMap[priceHistoryModal.itemId].p100,
                mean: itemMap[priceHistoryModal.itemId].mean,
                std: itemMap[priceHistoryModal.itemId].std,
                search_item_timestamp: itemMap[priceHistoryModal.itemId].search_item_timestamp,
              } : {}}
              onSetPrice={async (newPrice) => {
                if (priceHistoryModal.itemId) {
                  await handleChangePrice(
                    priceHistoryModal.itemId,
                    newPrice,
                    undefined,
                    false,
                    itemMap[priceHistoryModal.itemId]?.name
                  );
                  // Optionally, fetchItems() or fetchUserPrices() if needed for full refresh
                }
              }}
            />
          )}
          <SellModal
            open={sellModalOpen}
            onClose={() => { setSellModalOpen(false); setSellItem(null); }}
            onSell={(_, price) => {
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
            <StockModal
              open={stockDialog.open}
              onClose={() => setStockDialog({ open: false, itemId: undefined })}
              itemId={stockDialog.itemId ?? ''}
              itemName={itemMap[stockDialog.itemId ?? '']?.name ?? ''}
              userPriceMap={userPriceMap}
              characters={characters}
              selectedCharacterId={selectedCharacter ? selectedCharacter.id : null}
              setToast={setToast}
              priceHistoryData={priceHistoryData}
              onAddToStore={(characterId, itemId, amount) => {
                // Update characters state and localStorage
                setCharacters(chars => {
                  const updated = chars.map(c => {
                    if (c.id !== characterId) return c;
                    const counts = { ...(c.shop.itemCounts || {}) };
                    counts[itemId] = (counts[itemId] || 0) + amount;
                    const order = Array.isArray(c.shop.order) ? c.shop.order.slice() : [];
                    if (!order.includes(itemId)) order.push(itemId);
                    return { ...c, shop: { itemCounts: counts, order } };
                  });
                  localStorage.setItem('characters', JSON.stringify(updated));
                  const updatedChar = updated.find(c => c.id === characterId);
                  if (updatedChar) setSelectedCharacter(updatedChar);
                  setToast({ msg: `${amount}x ${itemMap[itemId]?.name ?? ''} added to store for ${updatedChar?.name ?? ''}.`, visible: true });
                  return updated;
                });
                setStockDialog({ open: false, itemId: undefined });
              }}
              onSetStock={(characterId, itemId, amount) => {
                // Update characters state and localStorage (set to specific amount)
                setCharacters(chars => {
                  const updated = chars.map(c => {
                    if (c.id !== characterId) return c;
                    const counts = { ...(c.shop.itemCounts || {}) };
                    counts[itemId] = amount;
                    const order = Array.isArray(c.shop.order) ? c.shop.order.slice() : [];
                    if (!order.includes(itemId)) order.push(itemId);
                    return { ...c, shop: { itemCounts: counts, order } };
                  });
                  localStorage.setItem('characters', JSON.stringify(updated));
                  const updatedChar = updated.find(c => c.id === characterId);
                  if (updatedChar) setSelectedCharacter(updatedChar);
                  setToast({ msg: `Stock for ${itemMap[itemId]?.name ?? ''} set to ${amount} for ${updatedChar?.name ?? ''}.`, visible: true });
                  return updated;
                });
                setStockDialog({ open: false, itemId: undefined });
              }}
              handleChangePrice={handleChangePrice}
              onRemoveFromStore={handleRemoveFromStore}
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
          {saleWarning?.open && (
            <SaleWarningModal
              open={saleWarning.open}
              onConfirm={confirmSaleWarning}
              onCancel={cancelSaleWarning}
              itemName={saleWarning.itemName}
            />
          )}
          <InvitesModal
            open={invitesModalOpen}
            onClose={() => setInvitesModalOpen(false)}
            onCreateInvite={async () => { await createInvite(); }}
            invites={invites}
            loading={invitesLoading || createInviteLoading}
            error={createInviteError}
            karma={userKarma}
          />
          {/* <DevResetButton /> */}
        </main>
      </UISettingsContext.Provider>
    </InvitesProvider>
  );
}
