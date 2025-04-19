// Standalone script to merge two inventory.db SQLite files into a new merged db.
// Usage: ts-node mergeInventoryDb.ts path/to/inventory1.db path/to/inventory2.db path/to/output.db

import Database from 'better-sqlite3';
import fs from 'fs';

function mergeInventoryDbs(dbPath1: string, dbPath2: string, outputPath: string) {
  // Remove output if it exists
  if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

  // Open source databases
  const db1 = new Database(dbPath1, { readonly: true });
  const db2 = new Database(dbPath2, { readonly: true });
  // Create output database
  const outDb = new Database(outputPath);

  // Assume table name is 'items' and has a primary key 'id'
  // Copy schema from db1
  const schema = db1.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='items'`).get();
  if (!schema) throw new Error('Table "items" not found in db1!');
  outDb.exec(schema.sql);

  // Read all items from both dbs
  const items1 = db1.prepare('SELECT * FROM items').all();
  const items2 = db2.prepare('SELECT * FROM items').all();
  // Merge, dedupe by id (keep the latest by updated_at if present)
  const merged: Record<string, any> = {};
  for (const item of items1) merged[item.id] = item;
  for (const item of items2) {
    if (!merged[item.id] || (item.updated_at && merged[item.id].updated_at && item.updated_at > merged[item.id].updated_at)) {
      merged[item.id] = item;
    }
  }
  // Insert merged items into output db
  const keys = Object.keys(merged);
  if (keys.length > 0) {
    const sample = merged[keys[0]];
    const columns = Object.keys(sample);
    const placeholders = columns.map(() => '?').join(',');
    const insert = outDb.prepare(`INSERT INTO items (${columns.join(',')}) VALUES (${placeholders})`);
    outDb.transaction(() => {
      for (const k of keys) {
        insert.run(columns.map(col => merged[k][col]));
      }
    })();
  }
  db1.close();
  db2.close();
  outDb.close();
  console.log(`Merged ${keys.length} items into ${outputPath}`);
}

// CLI usage
if (require.main === module) {
  const [,, db1, db2, out] = process.argv;
  if (!db1 || !db2 || !out) {
    console.error('Usage: ts-node mergeInventoryDb.ts path/to/inventory1.db path/to/inventory2.db path/to/output.db');
    process.exit(1);
  }
  mergeInventoryDbs(db1, db2, out);
}

export default mergeInventoryDbs;
