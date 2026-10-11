import type { SQLiteDatabase } from 'expo-sqlite';
import type { HrSample, Session, StepsInterval } from '@/types/models';
import { SETTING_KEYS, getSetting, setSetting } from './appSettings';

export function getSession(db: SQLiteDatabase, sessionId: string): Promise<Session | null> {
  return db.getFirstAsync<Session>('SELECT * FROM session WHERE session_id = ?', sessionId);
}

// Idempotent (FR-19): the UNIQUE (record_id, ts_utc) key makes a repeated pull insert nothing new.
// Returns how many rows were actually new.
export async function insertHrSamples(db: SQLiteDatabase, rows: HrSample[]): Promise<number> {
  let added = 0;
  await db.withTransactionAsync(async () => {
    for (const r of rows) {
      const res = await db.runAsync(
        'INSERT OR IGNORE INTO hr_sample (session_id, ts_utc, bpm, source_app, record_id) VALUES (?, ?, ?, ?, ?)',
        r.session_id, r.ts_utc, r.bpm, r.source_app, r.record_id,
      );
      added += res.changes;
    }
  });
  return added;
}

export async function insertStepsIntervals(db: SQLiteDatabase, rows: StepsInterval[]): Promise<number> {
  let added = 0;
  await db.withTransactionAsync(async () => {
    for (const r of rows) {
      const res = await db.runAsync(
        'INSERT OR IGNORE INTO steps_interval (session_id, start_utc, end_utc, count, record_id) VALUES (?, ?, ?, ?, ?)',
        r.session_id, r.start_utc, r.end_utc, r.count, r.record_id,
      );
      added += res.changes;
    }
  });
  return added;
}

// A successful pull marks a freshly recorded session as synced; an already exported one keeps its status.
export async function markSynced(db: SQLiteDatabase, sessionId: string, atUtc: string): Promise<void> {
  await db.runAsync(
    "UPDATE session SET hc_synced_at = ?, status = CASE WHEN status = 'recorded' THEN 'synced' ELSE status END WHERE session_id = ?",
    atUtc, sessionId,
  );
}

// The session table has no column for this (spec 7.1), so it lives in app_setting.
const workoutKey = (sessionId: string) => `${SETTING_KEYS.workoutFoundPrefix}${sessionId}`;

export function setWorkoutFound(db: SQLiteDatabase, sessionId: string, found: boolean | null): Promise<void> {
  return setSetting(db, workoutKey(sessionId), found === null ? 'unknown' : found ? '1' : '0');
}

export async function getWorkoutFound(db: SQLiteDatabase, sessionId: string): Promise<boolean | null> {
  const v = await getSetting(db, workoutKey(sessionId));
  return v === '1' ? true : v === '0' ? false : null;
}
