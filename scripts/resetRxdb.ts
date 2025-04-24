// DEV-ONLY: Script to reset (delete) the local RxDB database.
// Run this with: npx ts-node scripts/resetRxdb.ts
// Make sure you have ts-node and your environment set up to allow imports from your project.

import { getDb } from '../src/rxdb';

async function resetRxdb() {
  const db = await getDb();
  await db.remove();
  console.log('RxDB database has been deleted.');
}

resetRxdb().catch(err => {
  console.error('Failed to reset RxDB:', err);
  process.exit(1);
});
