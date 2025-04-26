// Appwrite document base type for type safety
export interface AppwriteBaseDocument {
  $id: string;
  $collectionId: string;
  $databaseId: string;
  $createdAt: string;
  $updatedAt: string;
  $permissions: string[];
}

export interface Item {
  $id: string; // Appwrite document ID
  name: string;
  // Price percentiles
  p0?: number;
  p25?: number;
  p50?: number;
  p75?: number;
  p100?: number;
  mean?: number;
  std?: number;
  search_results_captured?: number;
  sum_bundle?: number;
  num_outlier?: number;
  search_item_timestamp?: string | null;
  // Legacy/optional fields
  price?: number;
  current_selling_price?: number;
  date_created?: string;
  date_modified?: string;
  priceHistory?: PriceHistoryEntry[];
  owned?: boolean;
  notes?: string;
  added_to_shop_at?: string | null;
  price_change_history?: { timestamp: string; from: number; to: number }[];
}

export type ItemStats = Partial<Pick<Item, 'p0' | 'p25' | 'p50' | 'p75' | 'p100' | 'mean' | 'std' | 'search_item_timestamp'>>;

export interface PriceHistoryEntry {
  $id: string;     // Appwrite document ID, always present and used as the primary key
  itemId: string;
  price: number;
  date: string;
  author: string; // user_id
  author_ign?: string; // display IGN
  item_name?: string; // denormalized item name
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

// PersistentAnonLink now extends AppwriteBaseDocument for type safety
export interface PersistentAnonLink extends AppwriteBaseDocument {
  secret: string;
  userId: string;
  user_ign?: string;
  karma: number;
  whitelist?: string[];  // Array of userIds (string)
}