import { databases, client } from './appwrite';

const DB_ID = import.meta.env.VITE_APPWRITE_DATABASE;
const VERSION_COLLECTION_ID = import.meta.env.VITE_APPWRITE_VERSION_COLLECTION;
const VERSION_DOC_ID = '68078b750037abc8f081'; // If you used a unique document ID, replace with actual ID; otherwise, use 'unique()' to fetch the only doc

export async function fetchCurrentVersionFromAppwrite(): Promise<string> {
  // If you only have one doc, listDocuments and take the first
  const docs = await databases.listDocuments(DB_ID, VERSION_COLLECTION_ID);
  if (docs.documents.length === 0) throw new Error('No version document found');
  return docs.documents[0].build_version;
}

export function subscribeToVersionChange(callback: (version: string) => void) {
  // Subscribe to all docs in the collection if only one doc exists
  const channel = `databases.${DB_ID}.collections.${VERSION_COLLECTION_ID}.documents`;
  const unsub = client.subscribe(channel, (response: any) => {
    if (response.payload.build_version) {
      callback(response.payload.build_version);
    }
  });
  return unsub;
}
