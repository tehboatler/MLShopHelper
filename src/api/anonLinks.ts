import { databases } from '../lib/appwrite';
import { Query, ID } from 'appwrite';

const databaseId = import.meta.env.VITE_APPWRITE_DATABASE!;
const anonLinksCollectionId = import.meta.env.VITE_APPWRITE_ANON_LINKS_COLLECTION!;

// Fetch the IGN for a given userId from anon_links collection
export async function getIGNForUserId(userId: string): Promise<string | null> {
  const res = await databases.listDocuments(databaseId, anonLinksCollectionId, [
    Query.equal('userId', userId)
  ]);
  if (res.documents.length > 0) {
    return res.documents[0].user_ign || null;
  }
  return null;
}

// Set or update the IGN for a given userId in anon_links collection
export async function setIGNForUserId(userId: string, user_ign: string): Promise<void> {
  const res = await databases.listDocuments(databaseId, anonLinksCollectionId, [
    Query.equal('userId', userId)
  ]);
  if (res.documents.length > 0) {
    // Update existing document
    await databases.updateDocument(databaseId, anonLinksCollectionId, res.documents[0].$id, { user_ign });
  } else {
    // Create new document, must include 'secret' (browser safe)
    const uuid = (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID)
      ? window.crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
    await databases.createDocument(databaseId, anonLinksCollectionId, ID.unique(), { userId, user_ign, secret: uuid });
  }
}
