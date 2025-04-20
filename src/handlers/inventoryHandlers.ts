/**
 * Inventory context menu handlers for the inventory panel.
 */
import { Dispatch, SetStateAction } from 'react';

export function handleInventoryContextMenu(
  setInventoryContextMenu: Dispatch<SetStateAction<any>>
) {
  return (e: React.MouseEvent, itemId: string) => {
    e.preventDefault();
    setInventoryContextMenu((prev: any) => ({ ...prev, open: true, x: e.clientX, y: e.clientY, itemId }));
  };
}

export function handleCloseInventoryContextMenu(
  setInventoryContextMenu: Dispatch<SetStateAction<any>>,
  inventoryContextMenu: any
) {
  return () => {
    setInventoryContextMenu({ ...inventoryContextMenu, open: false });
  };
}

export function handleAdjustStock(
  setStockDialog: Dispatch<SetStateAction<any>>,
  inventoryContextMenu: any
) {
  return () => {
    if (inventoryContextMenu.itemId) {
      setStockDialog({ open: true, itemId: inventoryContextMenu.itemId });
    }
  };
}

export function handlePriceHistory(
  setPriceHistoryModal: Dispatch<SetStateAction<any>>,
  inventoryContextMenu: any
) {
  return () => {
    if (inventoryContextMenu.itemId) setPriceHistoryModal({ open: true, itemId: inventoryContextMenu.itemId });
  };
}

export function handleRecordSale(
  setSellItem: Dispatch<any>,
  setSellModalOpen: Dispatch<SetStateAction<boolean>>,
  itemMap: Record<string, any>,
  inventoryContextMenu: any
) {
  return () => {
    if (inventoryContextMenu.itemId) {
      setSellItem(itemMap[inventoryContextMenu.itemId]);
      setSellModalOpen(true);
    }
  };
}
