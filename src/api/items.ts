import { databases, account } from "../lib/appwrite";
import { getDb } from '../rxdb';

const databaseId = import.meta.env.VITE_APPWRITE_DATABASE!;
const collectionId = import.meta.env.VITE_APPWRITE_ITEMS_COLLECTION!;

export async function getItems() {
  return databases.listDocuments(databaseId, collectionId);
}

export async function addItem(data: { name: string; price: number; notes?: string }) {
  // Create in Appwrite, let Appwrite assign the ID
  const doc = await databases.createDocument(
    databaseId,
    collectionId,
    'unique()', // Let Appwrite generate the ID
    {
      ...data,
      owned: true,
      price: data.price,
    }
  );
  // Upsert to RxDB using Appwrite's $id as id
  const db = await getDb();
  await db.items.upsert({
    ...data,
    id: doc.$id,
    owned: true,
    price: data.price,
  });
}

export async function updateItem(id: string, data: Partial<{ name: string; price: number; notes: string }>) {
  return databases.updateDocument(databaseId, collectionId, id, data);
}

export async function deleteItem(id: string) {
  // Debug: check current session and user before attempting delete
  try {
    const session = await account.getSession("current");
    console.log("[deleteItem] Current session:", session);
  } catch (err) {
    console.warn("[deleteItem] No active session:", err);
  }
  try {
    const user = await account.get();
    console.log("[deleteItem] Current user:", user);
  } catch (err) {
    console.warn("[deleteItem] No user found:", err);
  }
  // Proceed with delete
  return databases.deleteDocument(databaseId, collectionId, id);
}