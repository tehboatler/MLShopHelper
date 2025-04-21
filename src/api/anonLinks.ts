import { databases } from '../lib/appwrite';
import { Query, ID } from 'appwrite';
import type { PersistentAnonLink } from '../types';

const databaseId = import.meta.env.VITE_APPWRITE_DATABASE!;
const anonLinksCollectionId = import.meta.env.VITE_APPWRITE_ANON_LINKS_COLLECTION!;

// Fetch the IGN for a given userId from anon_links collection
export async function getIGNForUserId(userId: string): Promise<string | null> {
  const res = await databases.listDocuments(databaseId, anonLinksCollectionId, [
    Query.equal('userId', userId)
  ]);
  if (res.documents.length > 0) {
    return (res.documents[0] as PersistentAnonLink).user_ign || null;
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
    await databases.updateDocument(databaseId, anonLinksCollectionId, (res.documents[0] as PersistentAnonLink).$id, { user_ign });
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

// --- Whitelist Management ---

/**
 * Get the anon_links document for a given userId.
 */
export async function getAnonLinkDocByUserId(userId: string): Promise<PersistentAnonLink | null> {
  const res = await databases.listDocuments(databaseId, anonLinksCollectionId, [
    Query.equal('userId', userId)
  ]);
  return (res.documents[0] as PersistentAnonLink) ?? null;
}

/**
 * Add a userId to the whitelist for the given anon_links document ($id).
 * Returns the updated document.
 */
export async function addUserToWhitelist(docId: string, userIdToAdd: string): Promise<PersistentAnonLink> {
  const doc = await databases.getDocument(databaseId, anonLinksCollectionId, docId) as PersistentAnonLink;
  const currentWhitelist = doc.whitelist ?? [];
  if (!currentWhitelist.includes(userIdToAdd)) {
    const updatedWhitelist = [...currentWhitelist, userIdToAdd];
    return await databases.updateDocument(databaseId, anonLinksCollectionId, docId, { whitelist: updatedWhitelist }) as PersistentAnonLink;
  }
  return doc;
}

/**
 * Remove a userId from the whitelist for the given anon_links document ($id).
 * Returns the updated document.
 */
export async function removeUserFromWhitelist(docId: string, userIdToRemove: string): Promise<PersistentAnonLink> {
  const doc = await databases.getDocument(databaseId, anonLinksCollectionId, docId) as PersistentAnonLink;
  const currentWhitelist = doc.whitelist ?? [];
  if (currentWhitelist.includes(userIdToRemove)) {
    const updatedWhitelist = currentWhitelist.filter(id => id !== userIdToRemove);
    return await databases.updateDocument(databaseId, anonLinksCollectionId, docId, { whitelist: updatedWhitelist }) as PersistentAnonLink;
  }
  return doc;
}

/**
 * Add a userId to the whitelist for the current user's anon_links document (by userId).
 */
export async function addUserToWhitelistByUserId(userId: string, userIdToAdd: string): Promise<PersistentAnonLink> {
  const doc = await getAnonLinkDocByUserId(userId);
  if (!doc) throw new Error('AnonLink document not found for userId: ' + userId);
  return addUserToWhitelist(doc.$id, userIdToAdd);
}

/**
 * Remove a userId from the whitelist for the current user's anon_links document (by userId).
 */
export async function removeUserFromWhitelistByUserId(userId: string, userIdToRemove: string): Promise<PersistentAnonLink> {
  const doc = await getAnonLinkDocByUserId(userId);
  if (!doc) throw new Error('AnonLink document not found for userId: ' + userId);
  return removeUserFromWhitelist(doc.$id, userIdToRemove);
}
