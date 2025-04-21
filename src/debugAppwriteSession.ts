import { account } from './lib/appwrite';

export async function debugAppwriteSession() {
  try {
    const user = await account.get();
    // eslint-disable-next-line no-console
    console.log('[Appwrite Session Debug] Current user:', user);
    return user;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[Appwrite Session Debug] No user session or error:', err);
    return null;
  }
}

// To use: import { debugAppwriteSession } from './debugAppwriteSession'; debugAppwriteSession();
