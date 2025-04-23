// Persistent Anonymous Login API
// This module implements a persistent anonymous identity system for Appwrite
// using a secret-to-userId mapping stored in a dedicated Appwrite collection.

import { account, databases } from '../lib/appwrite';
import { ID, Query, Models, Permission, Role } from 'appwrite';

// Use the same pattern as items.ts for config
const databaseId = import.meta.env.VITE_APPWRITE_DATABASE!;
const anonLinksCollectionId = import.meta.env.VITE_APPWRITE_ANON_LINKS_COLLECTION!;

// Utility to generate a fake email
function generateFakeEmail() {
  return `user_${crypto.randomUUID()}@mlshophelper.local`;
}

export async function createPersistentAnonUser(code?: string): Promise<{ user: Models.User<any>, secret: string, email: string }> {
  // 1. Generate a persistent secret
  const secret = crypto.randomUUID();
  const email = generateFakeEmail();
  // 2. Create Appwrite user with fake email and secret as password
  const user = await account.create(ID.unique(), email, secret);
  // 3. Store mapping in anon_links collection with PUBLIC (guests) read permissions
  // Attach code if provided
  const docData: Record<string, any> = { secret, userId: user.$id, email };
  if (code) docData.code = code;
  await databases.createDocument(
    databaseId,
    anonLinksCollectionId,
    ID.unique(),
    docData,
    [
      Permission.read(Role.any()),
      Permission.update(Role.guests()),
      Permission.delete(Role.guests())
    ]
  );
  return { user, secret, email };
}

// One-field login: use login key in format email:secret
export async function loginWithEmailAndSecret(email: string, secret: string): Promise<Models.User<any>> {
  // Appwrite 2.x: use createEmailPasswordSession for email/password login
  await account.createEmailPasswordSession(email, secret);
  return account.get();
}

export async function loginWithPersistentSecret(secret: string): Promise<{ userId: string, secret: string, email: string } | null> {
  // 1. Lookup mapping
  const docs = await databases.listDocuments(databaseId, anonLinksCollectionId, [
    Query.equal('secret', secret)
  ]);
  if (!docs.documents.length) return null;
  const { userId, email } = docs.documents[0];
  // 2. Login with email + secret
  await account.createSession(email, secret);
  return { userId, secret, email };
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
