import React from "react";
import { DragDropContext, Droppable, Draggable, DropResult, DroppableProvided, DroppableStateSnapshot, DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd';
import type { Character } from "./types";
import { CharacterDropdown } from "./CharacterDropdown";

interface InventoryPanelProps {
  characters: Character[];
  selectedCharacterId: string | null;
  setSelectedCharacterId: (id: string) => void;
  handleAddCharacter: () => void;
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
}) => (
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
                <div ref={provided.innerRef} {...provided.droppableProps} style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 40, paddingBottom: 200 }}>
                  {selectedCharacter.shop.order.map((itemId: string, idx: number) => {
                    const item = itemMap[itemId];
                    if (!item) return null;
                    const count = selectedCharacter.shop.itemCounts[itemId] || 0;
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
                            onClick={async () => {
                              let priceStr = (() => {
                                const userId = localStorage.getItem('persistentUserId') || '';
                                const entry = getLastUserPriceEntry(item.priceHistory || [], userId);
                                if (entry && typeof entry.price === 'number') return entry.price.toString();
                                if (typeof item.current_selling_price === 'number') return item.current_selling_price.toString();
                                return '';
                              })();
                              if (priceStr) {
                                await navigator.clipboard.writeText(priceStr);
                                setToast({ msg: `Copied price for ${item.name}`, visible: true });
                                if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
                                toastTimeoutRef.current = setTimeout(() => setToast({ msg: '', visible: false }), 1700);
                              }
                            }}
                            onContextMenu={e => {
                              e.preventDefault();
                              setInventoryContextMenu({ open: true, x: e.clientX, y: e.clientY, itemId: item.$id });
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                              <span style={{ fontWeight: 600, wordBreak: 'break-word', whiteSpace: 'normal', fontSize: 16, lineHeight: 1.18 }}>{item.name}</span>
                              <span style={{ color: '#a88f4a', fontWeight: 500, fontSize: 13, marginTop: 2 }}>
                                {(() => {
                                  // Always use the latest value from localStorage if present
                                  let localItems: any[] = [];
                                  try { localItems = JSON.parse(localStorage.getItem('localItems') || '[]'); } catch {}
                                  const localItem = localItems.find(i => i.$id === item.$id);
                                  const price = localItem?.current_selling_price ?? (userPriceMap?.[item.$id]?.price ?? item.current_selling_price);
                                  return price ? `${price.toLocaleString()} mesos` : '';
                                })()}
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
);

export default InventoryPanel;
