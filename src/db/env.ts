import type { SQLiteDatabase } from 'expo-sqlite';
import type { EnvReading } from '@/types/models';

export type NewEnvReading = Omit<EnvReading, 'id'>;

export async function insertEnvReading(db: SQLiteDatabase, r: NewEnvReading): Promise<void> {
  await db.runAsync(
    'INSERT INTO env_reading (session_id, ts_utc, air_temp_c, humidity_pct, source) VALUES (?, ?, ?, ?, ?)',
    r.session_id, r.ts_utc, r.air_temp_c, r.humidity_pct, r.source,
  );
}

export async function lastApiEnvTimestamp(db: SQLiteDatabase, sessionId: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ ts: string | null }>(
    "SELECT MAX(ts_utc) AS ts FROM env_reading WHERE session_id = ? AND source = 'api'",
    sessionId,
  );
  return row?.ts ?? null;
}
