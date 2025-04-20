// Persistent Anonymous Login API
// This module implements a persistent anonymous identity system for Appwrite
// using a secret-to-userId mapping stored in a dedicated Appwrite collection.

import { account, databases } from '../lib/appwrite';
import { ID, Query, Models, Permission, Role } from 'appwrite';

// Use the same pattern as items.ts for config
const databaseId = import.meta.env.VITE_APPWRITE_DATABASE!;
const anonLinksCollectionId = import.meta.env.VITE_APPWRITE_ANON_LINKS_COLLECTION!;

export async function createPersistentAnonUser(): Promise<{ user: Models.User<any>, secret: string }> {
  // 1. Create anonymous session
  const session = await account.createAnonymousSession();
  const user = await account.get();
  // 2. Generate a persistent secret
  const secret = crypto.randomUUID();
  // 3. Store mapping in anon_links collection with custom permissions
  await databases.createDocument(
    databaseId,
    anonLinksCollectionId,
    ID.unique(),
    { secret, userId: user.$id },
    [
      Permission.read(Role.user(user.$id)),
      Permission.update(Role.user(user.$id)),
      Permission.delete(Role.user(user.$id))
    ]
  );
  return { user, secret };
}

export async function loginWithPersistentSecret(secret: string): Promise<{ userId: string, secret: string } | null> {
  // 1. Lookup mapping
  const docs = await databases.listDocuments(databaseId, anonLinksCollectionId, [
    Query.equal('secret', secret)
  ]);
  if (!docs.documents.length) return null;
  const userId = docs.documents[0].userId;
  // 2. Do NOT create a new anonymous session!
  // 3. Return the persistent userId
  return { userId, secret };
}

// Utility to get the persistent userId for the current secret
export async function getPersistentUserId(secret: string): Promise<string | null> {
  const docs = await databases.listDocuments(databaseId, anonLinksCollectionId, [
    Query.equal('secret', secret)
  ]);
  if (!docs.documents.length) return null;
  return docs.documents[0].userId;
}

// Fetch persistent anonymous user document by userId or secret
export async function getPersistentAnonUserById(userId: string): Promise<any | null> {
  const docs = await databases.listDocuments(databaseId, anonLinksCollectionId, [
    Query.equal('userId', userId)
  ]);
  if (!docs.documents.length) return null;
  return docs.documents[0];
}

export async function getPersistentAnonUserBySecret(secret: string): Promise<any | null> {
  const docs = await databases.listDocuments(databaseId, anonLinksCollectionId, [
    Query.equal('secret', secret)
  ]);
  if (!docs.documents.length) return null;
  return docs.documents[0];
}

// Increment or decrement karma for a user by userId
export async function updateUserKarma(userId: string, delta: number): Promise<number> {
  // Get user doc from anon_links collection
  const docs = await databases.listDocuments(databaseId, anonLinksCollectionId, [
    Query.equal('userId', userId)
  ]);
  if (!docs.documents.length) throw new Error('User not found');
  const userDoc = docs.documents[0];
  const currentKarma = typeof userDoc.karma === 'number' ? userDoc.karma : 0;
  const newKarma = currentKarma + delta;
  await databases.updateDocument(databaseId, anonLinksCollectionId, userDoc.$id, { karma: newKarma });
  return newKarma;
}

/**
 * Batch fetch persistent anonymous user info (IGN, karma) for multiple userIds.
 * @param userIds Array of user IDs to fetch info for.
 * @returns Map of userId to { ign, karma }
 */
export async function getPersistentAnonUsersInfoBatch(userIds: string[]): Promise<Record<string, { ign?: string, karma?: number }>> {
  if (!userIds.length) return {};
  const chunkSize = 100;
  const chunks: string[][] = [];
  for (let i = 0; i < userIds.length; i += chunkSize) {
    chunks.push(userIds.slice(i, i + chunkSize));
  }
  let allDocs: any[] = [];
  for (const chunk of chunks) {
    const res = await databases.listDocuments(databaseId, anonLinksCollectionId, [
      Query.equal('userId', chunk),
      Query.limit(1000)
    ]);
    allDocs = allDocs.concat(res.documents);
  }
  const infoMap: Record<string, { ign?: string, karma?: number }> = {};
  for (const doc of allDocs) {
    infoMap[doc.userId] = {
      ign: doc.user_ign || undefined,
      karma: typeof doc.karma === 'number' ? doc.karma : undefined
    };
  }
  return infoMap;
}
