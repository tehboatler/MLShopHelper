import React, { useEffect, useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult, DroppableProvided, DroppableStateSnapshot, DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd';
import type { Character } from "./types";
import { CharacterDropdown } from "./CharacterDropdown";
import { NameInputModal } from "./NameInputModal";
import { ShopTimerModal } from "./ShopTimerModal";
import { InstantTooltip, useCharacterAddedToShopAt } from "./InstantTooltip";
import { useRecentPriceHistoryMap } from './hooks/useRecentPriceHistoryMap';
import { Spinner } from "./components/Spinner";

interface InventoryPanelProps {
  characters: Character[];
  selectedCharacterId: string | null;
  setSelectedCharacterId: (id: string | null) => void;
  handleAddCharacter: (char: Character) => void;
  handleDeleteCharacter: (id: string) => void;
  handleInventoryDragEnd: (result: DropResult) => void;
  itemMap: Record<string, any>;
  userPriceMap: Record<string, any>;
  setToast: (toast: { msg: string; visible: boolean }) => void;
  toastTimeoutRef: React.MutableRefObject<any>;
  setInventoryContextMenu: (ctx: { open: boolean; x: number; y: number; itemId: string }) => void;
  getLastUserPriceEntry: (priceHistory: any[], userId: string) => any;
  selectedCharacter: Character | null;
  handleOpenStockDialog: (id: string) => void;
  onRemoveFromStore: (characterId: string, itemId: string) => void;
  onItemSelected?: (itemName: string) => void;
  setSearch?: (v: string) => void;
  loading?: boolean;
}

export const InventoryPanel: React.FC<InventoryPanelProps> = ({
  characters,
  selectedCharacterId,
  setSelectedCharacterId,
  handleAddCharacter,
  handleDeleteCharacter,
  handleInventoryDragEnd,
  itemMap,
  userPriceMap,
  setToast,
  toastTimeoutRef,
  setInventoryContextMenu,
  getLastUserPriceEntry,
  selectedCharacter,
  handleOpenStockDialog,
  onRemoveFromStore,
  onItemSelected,
  setSearch,
  loading = false,
}) => {
  // console.log('[InventoryPanel] loading:', loading);
  const [addModalOpen, setAddModalOpen] = React.useState(false);
  const [shopTimerModalOpen, setShopTimerModalOpen] = React.useState(false);
  const [shopCloseTime, setShopCloseTime] = React.useState<Date | null>(null);
  const [countdown, setCountdown] = React.useState<string>("");

  // --- Stat dropdown state ---
  const statOptions = ["p0", "p25", "p50", "p75", "p100"] as const;
  type StatKey = typeof statOptions[number];
  const [selectedStat, setSelectedStat] = React.useState<StatKey>("p50");

  // Add sort by price state and UI
  const [sortByPrice, setSortByPrice] = React.useState<'none' | 'asc' | 'desc'>('none');

  // --- Add selection state for clicked item ---
  const [selectedItemId, setSelectedItemId] = React.useState<string | null>(null);

  // Merge localStorage info into itemMap for display
  const getMergedItemMap = () => {
    let localItems: any[] = [];
    try { localItems = JSON.parse(localStorage.getItem('localItems') || '[]'); } catch {}
    const merged = { ...itemMap };
    for (const localItem of localItems) {
      if (merged[localItem.$id]) {
        merged[localItem.$id] = { ...merged[localItem.$id], ...localItem };
      }
    }
    return merged;
  };
  const mergedItemMap = React.useMemo(getMergedItemMap, [itemMap, localStorage.getItem('localItems')]);

  // --- Fix: ensure persistentUserId is always string or undefined ---
  const persistentUserIdRaw = typeof window !== 'undefined' ? localStorage.getItem('persistentUserId') : undefined;
  const persistentUserId = persistentUserIdRaw ?? undefined;

  const itemIds = Object.keys(mergedItemMap);
  const recentPricesMap = useRecentPriceHistoryMap(itemIds, persistentUserId, 3);

  // --- LocalStorage-based addedToShopAtMap, character-specific ---
  function useAddedToShopAtMap(itemIds: string[], characterId: string | undefined, itemsLoaded: boolean) {
    const [map, setMap] = useState<Record<string, string | null>>({});
    useEffect(() => {
      if (!itemsLoaded || !characterId) {
        setMap({});
        return;
      }
      let stored: Record<string, Record<string, string | null>> = {};
      try {
        stored = JSON.parse(localStorage.getItem('addedToShopAtMap') || '{}');
      } catch {}
      const charMap = stored[characterId] || {};
      const newMap: Record<string, string | null> = {};
      for (const itemId of itemIds) {
        newMap[itemId] = charMap[itemId] ?? null;
      }
      setMap(newMap);
    }, [itemsLoaded, characterId, JSON.stringify(itemIds)]);
    return map;
  }

  // Assume itemsLoaded is true when mergedItemMap is non-empty
  const itemsLoaded = Object.keys(mergedItemMap).length > 0;
  // Ensure selectedCharacterId is string | undefined (never null)
  const safeCharacterId = selectedCharacterId === null ? undefined : selectedCharacterId;
  const addedToShopAtMap = useAddedToShopAtMap(itemIds, safeCharacterId, itemsLoaded);

  // --- Highlighted item state for click effect ---
  const [clickedItemId, setClickedItemId] = React.useState<string | null>(null);
  const fadeTimeout = React.useRef<NodeJS.Timeout | null>(null);

  function handleAddCharacterClick() {
    setAddModalOpen(true);
  }

  function handleModalSubmit(name: string) {
    if (!name.trim()) return;
    const newChar = { id: Math.random().toString(36).slice(2) + Date.now().toString(36), name: name.trim(), shop: { itemCounts: {}, order: [] } };
    handleAddCharacter(newChar);
    setSelectedCharacterId(newChar.id);
    setAddModalOpen(false);
  }

  function handleModalClose() {
    setAddModalOpen(false);
  }

  // Load shop close time from localStorage on mount or character change
  React.useEffect(() => {
    if (!selectedCharacter) return;
    const key = `shopCloseTime_${selectedCharacter.id}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      setShopCloseTime(new Date(stored));
    } else {
      setShopCloseTime(null);
    }
  }, [selectedCharacter]);

  // Live countdown timer
  React.useEffect(() => {
    if (!shopCloseTime) {
      setCountdown("");
      return;
    }
    function updateCountdown() {
      const now = new Date();
      const diff = shopCloseTime!.getTime() - now.getTime();
      if (diff <= 0) {
        setCountdown("00:00");
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdown(
        `${hours.toString().padStart(2, '0')}:` +
        `${minutes.toString().padStart(2, '0')}:` +
        `${seconds.toString().padStart(2, '0')}`
      );
    }
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [shopCloseTime]);

  function handleOpenShopTimerModal() {
    setShopTimerModalOpen(true);
  }

  function handleShopTimerSubmit(hours: number, minutes: number) {
    if (!selectedCharacter) return;
    const close = new Date(Date.now() + hours * 60 * 60 * 1000 + minutes * 60 * 1000);
    setShopCloseTime(close);
    localStorage.setItem(`shopCloseTime_${selectedCharacter.id}`, close.toISOString());
    setShopTimerModalOpen(false);
  }

  function handleShopTimerClose() {
    setShopTimerModalOpen(false);
  }

  // Format timestamp as relative (e.g. '2d ago', '3h ago', etc.)
  function formatRelativeDate(dateStr: string) {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHrs = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHrs > 0) return `${diffHrs}h ago`;
    if (diffMin > 0) return `${diffMin}m ago`;
    if (diffSec > 5) return `${diffSec}s ago`;
    return 'now';
  }

  // In the render of selectedCharacter.shop.order, apply sorting if needed
  const orderedItemIds = React.useMemo(() => {
    if (!selectedCharacter?.shop?.order) return [];
    if (sortByPrice === 'none') return selectedCharacter.shop.order;
    // Build price map for all items
    const priceMap: Record<string, number> = {};
    for (const itemId of selectedCharacter.shop.order) {
      const item = mergedItemMap[itemId];
      let price = 0;
      try {
        const localItems = JSON.parse(localStorage.getItem('localItems') || '[]');
        const localItem = localItems.find((i: any) => i.$id === item?.$id);
        price = typeof localItem?.current_selling_price === 'number' ? localItem.current_selling_price : 0;
      } catch {}
      if (userPriceMap instanceof Map && userPriceMap.get(itemId) && typeof userPriceMap.get(itemId).price === 'number') {
        price = userPriceMap.get(itemId).price;
      } else if (userPriceMap && typeof userPriceMap[itemId]?.price === 'number') {
        price = userPriceMap[itemId].price;
      } else if (!price && typeof item?.current_selling_price === 'number') {
        price = item.current_selling_price;
      }
      priceMap[itemId] = price;
    }
    return [...selectedCharacter.shop.order].sort((a, b) => {
      const pa = priceMap[a] ?? 0;
      const pb = priceMap[b] ?? 0;
      return sortByPrice === 'asc' ? pa - pb : pb - pa;
    });
  }, [selectedCharacter, mergedItemMap, userPriceMap, sortByPrice]);

  return (
    <aside
      className="inventory-panel-scroll"
      style={{
        height: '100%',
        minWidth: 230,
        maxWidth: 340,
        background: '#232323',
        borderRight: '1.5px solid #333',
        padding: '24px 14px 24px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 18, color: '#fff', letterSpacing: 0.5 }}>Shops</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleAddCharacterClick}
            className="modern-add-character-btn"
            title="Add Character"
            aria-label="Add Character"
          >
            <img src="/frederick.png" alt="Add Character" style={{ width: 22, height: 22, marginRight: 7, verticalAlign: 'middle', borderRadius: 4 }} />
            <span style={{ fontWeight: 600, fontSize: 16, letterSpacing: 0.1, verticalAlign: 'middle' }}>Add Character</span>
          </button>
        </div>
      </div>
      {/* Shop Timer Countdown */}
      {selectedCharacter && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ color: '#aab3c5', fontWeight: 500, fontSize: 16, letterSpacing: 0.1 }}>
            Shop closes in: <span style={{ fontFamily: 'monospace', color: '#2d8cff', fontWeight: 700, fontSize: 18 }}>{countdown || '--:--'}</span>
          </span>
          <button
            onClick={handleOpenShopTimerModal}
            className="modern-shop-timer-btn"
            title="Set Shop Timer"
            aria-label="Set Shop Timer"
            style={{
              background: 'none',
              border: 'none',
              borderRadius: 8,
              padding: 0,
              marginLeft: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              boxShadow: 'none',
              transition: 'background 0.15s',
              height: 28,
              width: 28,
              minWidth: 28,
              minHeight: 28,
            }}
          >
            <img src="/grandpaclock.png" alt="Set Shop Timer" style={{ width: 24, height: 24, borderRadius: 4 }} />
          </button>
        </div>
      )}
      <NameInputModal
        open={addModalOpen}
        onClose={handleModalClose}
        onSubmit={handleModalSubmit}
        title="Add New Character"
        label="Character Name"
        confirmText="Add"
      />
      <CharacterDropdown
        characters={characters}
        selectedCharacterId={selectedCharacterId}
        onSelect={setSelectedCharacterId}
        onDelete={handleDeleteCharacter}
      />
      {/* Total Sale Value Label */}
      {/* Removed as per user request */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }} />
      {/* Combined Stat and Sort Dropdowns Row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12,
        background: 'rgba(224,192,128,0.06)',
        borderRadius: 8,
        padding: '4px 10px',
        boxShadow: '0 1px 6px #0001',
      }}>
        <select
          id="stat-select"
          value={selectedStat}
          onChange={e => setSelectedStat(e.target.value as StatKey)}
          style={{
            fontSize: 15,
            padding: '2px 10px',
            borderRadius: 6,
            border: '1.5px solid #e0c080',
            background: '#232323',
            color: '#e0c080',
            fontWeight: 600,
            outline: 'none',
            minWidth: 70,
            marginRight: 2,
          }}
          title="Stat"
        >
          {statOptions.map(opt => (
            <option key={opt} value={opt}>{opt.toUpperCase()}</option>
          ))}
        </select>
        <select
          id="sort-price-select"
          value={sortByPrice}
          onChange={e => setSortByPrice(e.target.value as 'none' | 'asc' | 'desc')}
          style={{
            fontSize: 15,
            padding: '2px 10px',
            borderRadius: 6,
            border: '1.5px solid #e0c080',
            background: '#232323',
            color: '#e0c080',
            fontWeight: 600,
            outline: 'none',
            minWidth: 90,
          }}
          title="Sort by Price"
        >
          <option value="none">Sort</option>
          <option value="asc">Price ↑</option>
          <option value="desc">Price ↓</option>
        </select>
      </div>
      <div
        className="inventory-scrollbar-hide"
        style={{
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 6,
          background: '#232323',
          boxShadow: '0 2px 8px #0002',
          padding: '2px 0',
          overflow: 'visible', // Ensure parent is not scrollable
        }}
      >
        {loading ? (
          <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 180 }}>
            <Spinner size={36} />
          </div>
        ) : selectedCharacter && selectedCharacter.shop ? (
          Array.isArray(selectedCharacter.shop.order) ? (
            <DragDropContext onDragEnd={handleInventoryDragEnd}>
              <Droppable droppableId="shop-inventory" type="item">
                {(provided: DroppableProvided, _: DroppableStateSnapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="no-scrollbar"
                    style={{
                      overflowY: 'auto',
                      height: 'calc(100vh - 70px - 48px - 38px + 32px)',
                      minHeight: 0,
                      display: 'block',
                      gap: 8,
                      paddingBottom: 32, // Enough for drag handle and spacing
                    }}
                  >
                    {orderedItemIds.map((itemId: string, idx: number) => {
                      const item = mergedItemMap[itemId];
                      if (!item) return null;
                      const isLast = idx === orderedItemIds.length - 1;
                      const isSelected = selectedItemId === item.$id;
                      // --- Always prefer userPriceMap (Map) if available, then local, then default ---
                      let price = 0;
                      try {
                        const localItems = JSON.parse(localStorage.getItem('localItems') || '[]');
                        const localItem = localItems.find((i: any) => i.$id === item.$id);
                        price = typeof localItem?.current_selling_price === 'number' ? localItem.current_selling_price : 0;
                      } catch {}
                      if (userPriceMap instanceof Map && userPriceMap.get(item.$id) && typeof userPriceMap.get(item.$id).price === 'number') {
                        price = userPriceMap.get(item.$id).price;
                      } else if (userPriceMap && typeof userPriceMap[item.$id]?.price === 'number') {
                        price = userPriceMap[item.$id].price;
                      } else if (!price && typeof item.current_selling_price === 'number') {
                        price = item.current_selling_price;
                      }
                      const recentPrices = recentPricesMap[item.$id] || [];
                      const charAddedToShopAt = useCharacterAddedToShopAt(item.$id, selectedCharacterId ?? undefined);
                      return (
                        <React.Fragment key={item.$id}>
                          <Draggable key={item.$id} draggableId={item.$id} index={idx}>
                            {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                onClick={async () => {
                                  setSelectedItemId(item.$id);
                                  if (setSearch) setSearch(item.name);
                                  if (typeof price === 'number' && price > 0) {
                                    try {
                                      await navigator.clipboard.writeText(String(price));
                                      setToast && setToast({ msg: `Copied ${price.toLocaleString()} mesos to clipboard.`, visible: true });
                                    } catch (err) {
                                      setToast && setToast({ msg: `Failed to copy price.`, visible: true });
                                    }
                                  }
                                }}
                                style={{
                                  ...provided.draggableProps.style,
                                  marginBottom: isLast && !snapshot.isDragging ? 128 : 0,
                                  background: isSelected ? 'rgba(45,140,255,0.18)' : (snapshot.isDragging ? '#232323' : (clickedItemId === item.$id ? 'rgba(60, 120, 255, 0.18)' : 'transparent')),
                                  border: isSelected ? '2px solid #2d8cff' : (snapshot.isDragging ? '1.5px solid #2d8cff' : undefined),
                                  borderRadius: 8,
                                  transition: 'background 0.18s, border 0.18s',
                                  cursor: 'grab',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', boxShadow: snapshot.isDragging ? '0 2px 12px #0008' : undefined }}>
                                  <div style={{ flex: 1, display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
                                      <InstantTooltip
                                        content={(() => {
                                          let tooltip = '';
                                          if (charAddedToShopAt) {
                                            tooltip += `Added to shop: ${formatRelativeDate(charAddedToShopAt)}\n`;
                                          }
                                          if (recentPrices.length > 0) {
                                            tooltip += 'Recent prices:\n';
                                            recentPrices.forEach((entry, idx) => {
                                              const priceStr = typeof entry.price === 'number' ? entry.price.toLocaleString() : String(entry.price);
                                              tooltip += `${formatRelativeDate(entry.date)}: ${priceStr} mesos`;
                                              if (idx < recentPrices.length - 1) tooltip += '\n';
                                            });
                                          }
                                          return tooltip.trim();
                                        })()}
                                      >
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                                          <span style={{ fontWeight: 600, wordBreak: 'break-word', whiteSpace: 'normal', fontSize: 16, lineHeight: 1.18 }}>{item.name}</span>
                                          <span style={{ color: '#a88f4a', fontWeight: 500, fontSize: 13, marginTop: 2, whiteSpace: 'pre-line' }}>
                                            {typeof price === 'number' && price > 0
                                              ? `${price.toLocaleString()} mesos`
                                              : <span style={{color:'#e74c3c'}}>No price</span>}
                                          </span>
                                          {/* Stat and % diff display only */}
                                          <span style={{ color: '#2d8cff', fontSize: 13, fontWeight: 600, marginTop: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                                            {(() => {
                                              let statValue: number | undefined = undefined;
                                              if (statValue === undefined && typeof item[selectedStat] === 'number') statValue = item[selectedStat];

                                              let statDiffNode = null;
                                              if (typeof statValue === 'number' && typeof price === 'number' && price > 0) {
                                                const diff = ((price - statValue) / statValue) * 100;
                                                const diffStr = diff > 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`;
                                                const diffColor = diff > 0 ? '#2ecc40' : (diff < 0 ? '#e74c3c' : '#aaa');
                                                statDiffNode = (
                                                  <>
                                                    {`${selectedStat.toUpperCase()}: ${statValue.toLocaleString()} (`}
                                                    <span style={{ color: diffColor }}>{diffStr}</span>
                                                    {`)`}
                                                  </>
                                                );
                                              } else if (typeof statValue === 'number') {
                                                statDiffNode = `${selectedStat.toUpperCase()}: ${statValue.toLocaleString()}`;
                                              } else {
                                                statDiffNode = `${selectedStat.toUpperCase()}: N/A`;
                                              }

                                              return (
                                                <>
                                                  <span>{statDiffNode}</span>
                                                  <span style={{ color: '#b3b3b3', fontSize: 12, fontWeight: 400, marginTop: 2 }}>
                                                    {item.search_item_timestamp
                                                      ? `OwlRepo 🔛 ${formatRelativeDate(item.search_item_timestamp)}`
                                                      : ''}
                                                  </span>
                                                </>
                                              );
                                            })()}
                                          </span>
                                        </div>
                                      </InstantTooltip>
                                    </div>
                                    <span
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginLeft: 10,
                                        width: 32,
                                        height: 32,
                                        aspectRatio: '1 / 1',
                                        borderRadius: 999,
                                        background: 'linear-gradient(90deg, #f8ecd5 0%, #e7c873 50%, #a86e2f 100%)',
                                        boxShadow: '0 2px 8px #0002',
                                        border: '1.5px solid #e0c08080',
                                        cursor: 'pointer',
                                        userSelect: 'none',
                                        transition: 'background 0.15s',
                                      }}
                                      onClick={e => {
                                        e.stopPropagation();
                                        handleOpenStockDialog(item.$id);
                                      }}
                                      title="Adjust stock"
                                    >
                                      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <rect y="4" width="20" height="2.5" rx="1.25" fill="#a86e2f" />
                                        <rect y="8.75" width="20" height="2.5" rx="1.25" fill="#a86e2f" />
                                        <rect y="13.5" width="20" height="2.5" rx="1.25" fill="#a86e2f" />
                                      </svg>
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                          {idx < orderedItemIds.length - 1 && (
                            <div style={{height:1, background:'linear-gradient(90deg,#3a3a3a 0%,#2d8cff44 100%)', margin:'6px 2px 6px 10px', borderRadius:1}} />
                          )}
                        </React.Fragment>
                      );
                    })}
                    {selectedCharacter.shop.order.length === 0 && (
                      <div style={{ color: '#888', fontSize: 15, marginTop: 4, marginBottom: 6 }}>No items</div>
                    )}
                    {provided.placeholder}
                    {/* Non-draggable, non-droppable spacer item for bottom padding (visible for testing) */}
                    <div
                      aria-hidden="true"
                      style={{
                        height: 200,
                        // background: 'rgba(46,204,113,0.25)', // light green for visibility
                        // border: '1px dashed #27ae60',
                        pointerEvents: 'none',
                        userSelect: 'none',
                      }}
                    />
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
      <ShopTimerModal
        open={shopTimerModalOpen}
        onClose={handleShopTimerClose}
        onSubmit={handleShopTimerSubmit}
      />
    </aside>
  );
}

export default InventoryPanel;
