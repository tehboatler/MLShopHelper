import type { PriceEntry } from "./PriceHistoryModal";

export interface Item {
  id: number;
  name: string;
  current_selling_price: number;
  date_created: string;
  date_modified: string;
  priceHistory?: PriceEntry[];
  owned?: boolean;
}
