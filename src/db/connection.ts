import { openDatabaseAsync } from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { migrate } from './migrations';

export const DB_NAME = 'hikelogger.db';

let dbPromise: Promise<SQLiteDatabase> | null = null;

// For code that runs outside React (the background location task). The UI uses SQLiteProvider.
// Both open the same file; WAL mode (set in migrate) allows concurrent use.
export function getBackgroundDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabaseAsync(DB_NAME).then(async (db) => {
      await migrate(db);
      return db;
    });
  }
  return dbPromise;
}
