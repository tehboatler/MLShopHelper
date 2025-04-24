// API stubs for invites system
import { Query } from 'appwrite';
import { databases } from '../lib/appwrite';
import { updateUserKarma } from './persistentAnon';

const INVITES_COLLECTION = import.meta.env.VITE_APPWRITE_INVITES_COLLECTION;
// const ANON_LINKS_COLLECTION = import.meta.env.VITE_APPWRITE_ANON_LINKS_COLLECTION;
const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE;

// TypeScript type for Invite matching your schema
export type Invite = {
  code: string;
  createdBy: string;
  usedBy?: string | null;
  status: 'redeemed' | 'unredeemed' | 'expired';
  createdAt: string;
  usedAt?: string | null;
};

export async function listInvitesByUser(userId: string): Promise<Invite[]> {
  // Query Appwrite for invites where createdBy == userId
  const res = await databases.listDocuments(
    DATABASE_ID,
    INVITES_COLLECTION,
    [Query.equal('createdBy', userId), Query.orderDesc('createdAt'), Query.limit(50)]
  );
  return res.documents.map((doc: any) => ({
    code: doc.code,
    createdBy: doc.createdBy,
    usedBy: doc.usedBy ?? null,
    status: doc.status as Invite['status'],
    createdAt: doc.createdAt,
    usedAt: doc.usedAt ?? null,
  }));
}

export async function createInvite(userId: string): Promise<{ code: string }> {
  // Decrement user karma by 10 before creating invite
  await updateUserKarma(userId, -10);
  const code = Math.random().toString(36).substring(2, 10).toUpperCase();
  const now = new Date().toISOString();
  let doc;
  try {
    doc = await databases.createDocument(
      DATABASE_ID,
      INVITES_COLLECTION,
      code, // Use code as the document ID to match RxDB primary key
      {
        code,
        createdBy: userId,
        status: 'unredeemed',
        createdAt: now,
        usedBy: null,
        usedAt: null,
      }
    );
  } catch (e: any) {
    // If duplicate code, retry with a new code (very rare)
    if (e?.code === 409 || (e?.message || '').includes('already exists')) {
      return await createInvite(userId); // Retry recursively
    }
    throw e;
  }
  return { code: doc.code };
}

export async function redeemInvite(inviteCode: string, userId: string) {
  // 1. Fetch invite by code
  const res = await databases.listDocuments(
    DATABASE_ID,
    INVITES_COLLECTION,
    [Query.equal('code', inviteCode), Query.limit(1)]
  );
  if (!res.documents.length) throw new Error('Invalid invite code');
  const invite = res.documents[0];
  if (invite.status !== 'unredeemed') throw new Error('Invite already used or expired');

  // 2. Mark as redeemed
  await databases.updateDocument(
    DATABASE_ID,
    INVITES_COLLECTION,
    invite.$id,
    {
      status: 'redeemed',
      usedBy: userId,
      usedAt: new Date().toISOString(),
    }
  );
  return true;
}
