import { account } from '../lib/appwrite';

/**
 * Ensures there is a valid Appwrite anonymous session for API access.
 * Only creates a new session if none exists.
 */
export async function ensureAnonymousSession() {
  try {
    await account.get(); // Will throw if no session
  } catch {
    await account.createAnonymousSession();
  }
}
