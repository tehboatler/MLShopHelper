import { Client, Account, Models } from "appwrite";

const client = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT!)
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT!);

export const account = new Account(client);

export async function getCurrentUser(): Promise<Models.User<Models.Preferences> | null> {
  try {
    return await account.get();
  } catch {
    return null;
  }
}

export async function createAnonymousSession() {
  return account.createAnonymousSession();
}

export async function createJWT() {
  return account.createJWT();
}


export async function logout() {
  await account.deleteSession("current");
}

// Create an anonymous session and return both the user and session info
export async function createAnonymousSessionWithSessionId() {
  const session = await account.createAnonymousSession();
  const user = await account.get();
  // Return both session and user info
  return { user, session };
}

// Restore a session using a session ID
export async function restoreSessionWithSessionId(sessionId: string) {
  await account.updateSession(sessionId);
  return account.get();
}
