import type { SQLiteDatabase } from 'expo-sqlite';
import type { Session } from '@/types/models';

export function listSessions(db: SQLiteDatabase): Promise<Session[]> {
  return db.getAllAsync<Session>('SELECT * FROM session ORDER BY start_utc DESC');
}
