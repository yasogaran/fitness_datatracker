import type { SQLiteDatabase } from 'expo-sqlite';
import type { Session } from '@/types/models';

export type NewSession = Pick<
  Session,
  | 'user_id'
  | 'start_utc'
  | 'utc_offset_min'
  | 'reminder_interval_min'
  | 'sleep_quality'
  | 'water_carried_ml'
  | 'clothing_note'
  | 'session_note'
>;

export function listSessions(db: SQLiteDatabase): Promise<Session[]> {
  return db.getAllAsync<Session>('SELECT * FROM session ORDER BY start_utc DESC');
}

export function getActiveSession(db: SQLiteDatabase): Promise<Session | null> {
  return db.getFirstAsync<Session>("SELECT * FROM session WHERE status = 'active' LIMIT 1");
}

// FR-1 / FR-4: ids are S001, S002, ...; only one active session at a time.
export async function createSession(db: SQLiteDatabase, s: NewSession): Promise<Session> {
  const active = await getActiveSession(db);
  if (active) throw new Error(`Session ${active.session_id} is already active.`);
  const row = await db.getFirstAsync<{ n: number | null }>(
    'SELECT MAX(CAST(SUBSTR(session_id, 2) AS INTEGER)) AS n FROM session',
  );
  const sessionId = `S${String((row?.n ?? 0) + 1).padStart(3, '0')}`;
  await db.runAsync(
    `INSERT INTO session (session_id, user_id, start_utc, end_utc, utc_offset_min, reminder_interval_min,
       sleep_quality, water_carried_ml, clothing_note, session_note, status, hc_synced_at)
     VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, 'active', NULL)`,
    sessionId, s.user_id, s.start_utc, s.utc_offset_min, s.reminder_interval_min,
    s.sleep_quality, s.water_carried_ml, s.clothing_note, s.session_note,
  );
  return { ...s, session_id: sessionId, end_utc: null, status: 'active', hc_synced_at: null };
}

export async function endSession(db: SQLiteDatabase, sessionId: string, endUtc: string): Promise<void> {
  await db.runAsync(
    "UPDATE session SET end_utc = ?, status = 'recorded' WHERE session_id = ?",
    endUtc, sessionId,
  );
}
