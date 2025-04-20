import { databases } from "../lib/appwrite";

const databaseId = import.meta.env.VITE_APPWRITE_DATABASE!;
const collectionId = import.meta.env.VITE_APPWRITE_ITEMS_COLLECTION!;

export async function getItems() {
  return databases.listDocuments(databaseId, collectionId);
}

export async function addItem(data: { name: string; price: number; notes?: string }) {
  return databases.createDocument(databaseId, collectionId, 'unique()', data);
}

export async function updateItem(id: string, data: Partial<{ name: string; price: number; notes: string }>) {
  return databases.updateDocument(databaseId, collectionId, id, data);
}

export async function deleteItem(id: string) {
  return databases.deleteDocument(databaseId, collectionId, id);
}