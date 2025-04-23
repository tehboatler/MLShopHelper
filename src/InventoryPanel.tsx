import React from "react";
import { DragDropContext, Droppable, Draggable, DropResult, DroppableProvided, DroppableStateSnapshot, DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd';
import type { Character } from "./types";
import { CharacterDropdown } from "./CharacterDropdown";
import { NameInputModal } from "./NameInputModal";
import { ShopTimerModal } from "./ShopTimerModal";

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
  // getLastUserPriceEntry,
  selectedCharacter,
  handleOpenStockDialog,
  // onRemoveFromStore,
  onItemSelected,
}) => {
  const [addModalOpen, setAddModalOpen] = React.useState(false);
  const [shopTimerModalOpen, setShopTimerModalOpen] = React.useState(false);
  const [shopCloseTime, setShopCloseTime] = React.useState<Date | null>(null);
  const [countdown, setCountdown] = React.useState<string>("");

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

  return (
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
      {selectedCharacter && selectedCharacter.shop && Array.isArray(selectedCharacter.shop.order) && selectedCharacter.shop.order.length > 0 && (
        (() => {
          let total = 0;
          selectedCharacter.shop.order.forEach((itemId: string) => {
            const item = itemMap[itemId];
            if (!item) return;
            const count = selectedCharacter.shop.itemCounts[itemId] || 0;
            const safeCount = typeof count === 'number' && !isNaN(count) ? count : 0;
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
            total += safeCount * price;
          });
          return (
            <div style={{ color: '#e0c080', fontWeight: 700, fontSize: 16, margin: '2px 0 8px 0', letterSpacing: 0.2 }}>
              Total Sale Value: {total.toLocaleString()} mesos
            </div>
          );
        })()
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }} />
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
                {(provided: DroppableProvided, _: DroppableStateSnapshot) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} style={{ display: 'block', gap: 8, minHeight: 40, paddingBottom: 0 }}>
                    {selectedCharacter.shop.order.map((itemId: string, idx: number) => {
                      const item = itemMap[itemId];
                      if (!item) return null;
                      const count = selectedCharacter.shop.itemCounts[itemId] || 0;
                      const safeCount = typeof count === 'number' && !isNaN(count) ? count : 0;
                      // --- Always prefer userPriceMap (Map) if available, then local, then default ---
                      let price = 0;
                      let debugTooltip = '';
                      try {
                        const localItems = JSON.parse(localStorage.getItem('localItems') || '[]');
                        const localItem = localItems.find((i: any) => i.$id === item.$id);
                        debugTooltip = `local: ${localItem?.current_selling_price} | user: ${userPriceMap instanceof Map ? userPriceMap.get(item.$id)?.price : userPriceMap?.[item.$id]?.price} | default: ${item.current_selling_price}`;
                        price = typeof localItem?.current_selling_price === 'number' ? localItem.current_selling_price : 0;
                      } catch {}
                      if (userPriceMap instanceof Map && userPriceMap.get(item.$id) && typeof userPriceMap.get(item.$id).price === 'number') {
                        price = userPriceMap.get(item.$id).price;
                      } else if (userPriceMap && typeof userPriceMap[item.$id]?.price === 'number') {
                        price = userPriceMap[item.$id].price;
                      } else if (!price && typeof item.current_selling_price === 'number') {
                        price = item.current_selling_price;
                      }
                      // const value = safeCount * price;
                      return (
                        <Draggable key={item.$id} draggableId={item.$id} index={idx}>
                          {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                background: snapshot.isDragging ? '#232323' : 'transparent',
                                borderRadius: 8,
                                boxShadow: snapshot.isDragging ? '0 2px 12px #0008' : undefined,
                                border: snapshot.isDragging ? '1.5px solid #2d8cff' : undefined,
                                padding: '7px 8px',
                                marginBottom: 1,
                                cursor: 'grab',
                                transition: 'background 0.15s, box-shadow 0.15s, border 0.15s',
                                ...provided.draggableProps.style,
                              }}
                              onClick={() => {
                                if (onItemSelected) onItemSelected(item.name);
                                if (typeof price === 'number' && price > 0) {
                                  navigator.clipboard.writeText(price.toString());
                                  setToast({ msg: `Copied price: ${price.toLocaleString()} mesos`, visible: true });
                                  if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
                                  toastTimeoutRef.current = setTimeout(() => setToast({ msg: '', visible: false }), 1700);
                                }
                              }}
                              onDoubleClick={() => {
                                navigator.clipboard.writeText(item.name);
                                setToast({ msg: `Copied ${item.name}`, visible: true });
                                if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
                                toastTimeoutRef.current = setTimeout(() => setToast({ msg: '', visible: false }), 1700);
                              }}
                              onContextMenu={e => {
                                e.preventDefault();
                                setInventoryContextMenu({ open: true, x: e.clientX, y: e.clientY, itemId: item.$id });
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                                <span style={{ fontWeight: 600, wordBreak: 'break-word', whiteSpace: 'normal', fontSize: 16, lineHeight: 1.18 }}>{item.name}</span>
                                <span style={{ color: '#a88f4a', fontWeight: 500, fontSize: 13, marginTop: 2, whiteSpace: 'pre-line' }} title={debugTooltip}>
                                  {typeof price === 'number' && price > 0
                                    ? `${price.toLocaleString()} mesos${safeCount > 0 ? `\n(${(safeCount*price).toLocaleString()} total)` : ''}`
                                    : <span style={{color:'#e74c3c'}}>No price</span>}
                                </span>
                              </div>
                              <span
                                style={{
                                  color: 'rgba(60,40,16,0.92)',
                                  background: 'linear-gradient(90deg, #f8ecd5 0%, #e7c873 50%, #a86e2f 100%)',
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
                                  cursor: 'pointer',
                                  userSelect: 'none',
                                }}
                                onClick={e => {
                                  e.stopPropagation();
                                  handleOpenStockDialog(item.$id);
                                }}
                                title="Adjust stock"
                              >{safeCount}x</span>
                            </div>
                          )}
                        </Draggable>
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
// Removed <style> tag with button CSS. Please see App.css for styles.
