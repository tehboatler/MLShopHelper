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

export async function loginWithPersistentSecret(secret: string): Promise<{ user: Models.User<any>, secret: string } | null> {
  // 1. Lookup mapping
  const docs = await databases.listDocuments(databaseId, anonLinksCollectionId, [
    Query.equal('secret', secret)
  ]);
  if (!docs.documents.length) return null;
  const userId = docs.documents[0].userId;
  // 2. Create a new anonymous session
  await account.createAnonymousSession();
  // 3. Use the persistent userId for all app data (not the new session's user)
  // 4. Optionally, update preferences or merge data if needed
  const user = await account.get();
  // Note: the current session's user is not the persistent user, but for all app data you should use userId from mapping
  // If you want to show the persistent user's info, you will need to query as admin or via a backend function
  return { user: { ...user, $id: userId }, secret };
}

// Utility to get the persistent userId for the current secret
export async function getPersistentUserId(secret: string): Promise<string | null> {
  const docs = await databases.listDocuments(databaseId, anonLinksCollectionId, [
    Query.equal('secret', secret)
  ]);
  if (!docs.documents.length) return null;
  return docs.documents[0].userId;
}
