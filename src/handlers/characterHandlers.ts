import { Character } from '../types';

/**
 * Update the stock for a character and persist to localStorage.
 * Also updates selectedCharacter if it matches.
 */
export function handleStock(
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>,
  setSelectedCharacter: (c: Character) => void,
  setStockDialog: (v: any) => void
) {
  return (characterId: string, itemId: string, amount: number) => {
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
      return updated;
    });
    setStockDialog({ open: false, itemId: undefined });
  };
}

/**
 * Delete an inventory item from a character's shop.
 */
export function handleDeleteInventoryItem(
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>,
  selectedCharacter: Character | null,
  inventoryContextMenu: { itemId?: string },
) {
  return () => {
    if (!inventoryContextMenu.itemId || !selectedCharacter) return;
    setCharacters(chars => chars.map(c => {
      if (c.id !== selectedCharacter.id) return c;
      const counts = { ...(c.shop.itemCounts || {}) };
      const id = inventoryContextMenu.itemId!;
      delete counts[id];
      const order = Array.isArray(c.shop.order) ? c.shop.order.filter(itemId => itemId !== id) : [];
      return { ...c, shop: { itemCounts: counts, order } };
    }));
  };
}

/**
 * Add a new character and select it.
 */
export function handleAddCharacter(
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>,
  setSelectedCharacter: (c: Character) => void
) {
  return () => {
    const name = prompt('Enter new character name:');
    if (!name) return;
    const newChar = { id: Math.random().toString(36).slice(2) + Date.now().toString(36), name, shop: { itemCounts: {}, order: [] } };
    setCharacters(chars => [...chars, newChar]);
    setSelectedCharacter(newChar);
  };
}

/**
 * Handle character select (by id).
 */
export function handleCharacterSelect(
  characters: Character[],
  setSelectedCharacter: (c: Character|null) => void
) {
  return (id: string) => {
    const found = characters.find(c => c.id === id) || null;
    setSelectedCharacter(found);
  };
}

/**
 * Handle character change from a select event.
 */
export function handleCharacterChange(
  handleCharacterSelect: (id: string) => void
) {
  return (e: React.ChangeEvent<HTMLSelectElement>) => {
    handleCharacterSelect(e.target.value);
  };
}
