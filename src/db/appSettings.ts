import type { SQLiteDatabase } from 'expo-sqlite';

export const SETTING_KEYS = {
  batteryConfirmed: 'checklist.battery_confirmed',
  samsungSharingConfirmed: 'checklist.samsung_sharing_confirmed',
  lastCheckedAt: 'checklist.last_checked_at',
  workoutFoundPrefix: 'hc.workout_found.',
} as const;

export async function getSetting(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_setting WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setSetting(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO app_setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key, value,
  );
}
