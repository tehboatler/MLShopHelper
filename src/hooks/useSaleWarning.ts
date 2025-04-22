import { useState, useRef, useEffect } from "react";
import { PriceHistoryEntry } from "../types";

function hasSoldInLast24h(priceHistory: PriceHistoryEntry[], itemId: string, userId: string | null): boolean {
  if (!userId) return false;
  const now = Date.now();
  return priceHistory.some(e =>
    e.author === userId &&
    e.itemId === itemId &&
    e.sold &&
    !!e.date && !isNaN(new Date(e.date).getTime()) &&
    (now - new Date(e.date).getTime() < 24 * 60 * 60 * 1000)
  );
}

export function useSaleWarning(priceHistory: PriceHistoryEntry[], itemId: string, userId: string | null) {
  const [modalOpen, setModalOpen] = useState(false);
  const alreadyLogged24h = hasSoldInLast24h(priceHistory, itemId, userId);
  // Track if modal was ever opened for this itemId during this mount
  const warnedForItem = useRef<string | null>(null);

  // Reset modal state if item changes
  useEffect(() => {
    setModalOpen(false);
    warnedForItem.current = null;
  }, [itemId, userId]);

  function checkShouldWarn() {
    // If already logged, never open modal
    if (alreadyLogged24h) return false;
    // Only open if we haven't already opened for this item in this session
    if (!modalOpen && warnedForItem.current !== itemId) {
      setModalOpen(true);
      warnedForItem.current = itemId;
      return true;
    }
    return false;
  }
  function closeWarning() { setModalOpen(false); }
  return { modalOpen, checkShouldWarn, closeWarning, alreadyLogged24h };
}
