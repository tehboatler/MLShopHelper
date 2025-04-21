import { Client, Databases, Account } from "appwrite";

export const client = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT!)
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT!);

export const account = new Account(client);
export const databases = new Databases(client);
export { client as default };