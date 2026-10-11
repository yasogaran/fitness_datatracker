import type { SQLiteDatabase } from 'expo-sqlite';
import type { GpsPoint } from '@/types/models';

export type NewGpsPoint = Omit<GpsPoint, 'id'>;

export async function insertGpsPoint(db: SQLiteDatabase, p: NewGpsPoint): Promise<void> {
  await db.runAsync(
    `INSERT INTO gps_point (session_id, ts_utc, lat, lon, speed_mps, accuracy_m, altitude_m)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    p.session_id, p.ts_utc, p.lat, p.lon, p.speed_mps, p.accuracy_m, p.altitude_m,
  );
}

export function gpsPointsAfter(db: SQLiteDatabase, sessionId: string, afterId: number): Promise<GpsPoint[]> {
  return db.getAllAsync<GpsPoint>(
    'SELECT * FROM gps_point WHERE session_id = ? AND id > ? ORDER BY id',
    sessionId, afterId,
  );
}

export async function lastGpsTimestamp(db: SQLiteDatabase, sessionId: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ ts: string | null }>(
    'SELECT MAX(ts_utc) AS ts FROM gps_point WHERE session_id = ?',
    sessionId,
  );
  return row?.ts ?? null;
}

// Temporary debug helper for the Stage 3 phone test.
export async function countAllGpsPoints(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM gps_point');
  return row?.n ?? 0;
}
