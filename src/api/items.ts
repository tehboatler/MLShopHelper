import { databases } from "../lib/appwrite";
import { getDb } from '../rxdb';
import { nanoid } from 'nanoid';

const databaseId = import.meta.env.VITE_APPWRITE_DATABASE!;
const collectionId = import.meta.env.VITE_APPWRITE_ITEMS_COLLECTION!;

export async function getItems() {
  return databases.listDocuments(databaseId, collectionId);
}

export async function addItem(data: { name: string; price: number; notes?: string }) {
  const db = await getDb();
  const id = nanoid();
  // Insert item into RxDB; Appwrite sync handled by replication
  return db.items.insert({
    ...data,
    id,
    owned: true,
    current_selling_price: data.price,
  });
}

export async function updateItem(id: string, data: Partial<{ name: string; price: number; notes: string }>) {
  return databases.updateDocument(databaseId, collectionId, id, data);
}

export async function deleteItem(id: string) {
  return databases.deleteDocument(databaseId, collectionId, id);
}