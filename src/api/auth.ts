import { Client, Account, Models } from "appwrite";

const client = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT!)
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT!);

export const account = new Account(client);

export async function logout() {
  await account.deleteSession("current");
  // Remove persistent user data from localStorage on logout
  localStorage.removeItem('persistentSecret');
  localStorage.removeItem('persistentUserId');
  localStorage.removeItem('persistentEmail');
}

export async function getCurrentUser(): Promise<Models.User<Models.Preferences> | null> {
  try {
    return await account.get();
  } catch {
    return null;
  }
}
