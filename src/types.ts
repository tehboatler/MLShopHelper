export interface Item {
  $id: string; // Appwrite document ID
  name: string;
  price?: number;
  current_selling_price?: number;
  date_created?: string;
  date_modified?: string;
  priceHistory?: PriceHistoryEntry[];
  owned?: boolean;
  notes?: string;
}

export interface PriceHistoryEntry {
  $id: string;
  itemId: string;
  price: number;
  date: string;
  author: string; // user_id
  author_ign?: string; // display IGN
  notes?: string;
  sold?: boolean;
  downvotes?: string[]; // array of userIds who downvoted this entry
}

export interface Character {
  id: string;
  name: string;
  shop: {
    itemCounts: Record<string, number>;
    order: string[];
  };
}

export interface PersistentUser {
  userId: string;
  user_ign?: string;
  karma: number;
}

export interface InventorySection {
  id: string;
  name: string;
  itemIds: string[];
}
