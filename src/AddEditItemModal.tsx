import React from "react";
import { Modal } from "./Modal";
import { ItemNameAutocomplete } from "./ItemNameAutocomplete";

interface AddEditItemModalProps {
  open: boolean;
  modalState: any;
  dispatchModal: (action: any) => void;
  items: any[];
  handleAddOrEdit: (e: React.FormEvent) => void;
}

const AddEditItemModal: React.FC<AddEditItemModalProps> = ({
  open,
  modalState,
  dispatchModal,
  items,
  handleAddOrEdit
}) => (
  <Modal open={open} onClose={() => dispatchModal({ type: 'CLOSE' })}>
    <h2>{modalState.editingItem ? "Edit Item" : "Add Item"}</h2>
    <form onSubmit={handleAddOrEdit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <ItemNameAutocomplete
        value={modalState.name}
        onChange={(value: string) => dispatchModal({ type: 'SET_NAME', value })}
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
);

export default AddEditItemModal;
