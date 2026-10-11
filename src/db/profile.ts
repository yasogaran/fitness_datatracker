import type { SQLiteDatabase } from 'expo-sqlite';
import type { Profile } from '@/types/models';

export type ProfileFields = Omit<Profile, 'consent_version' | 'consent_at'>;

export function getProfile(db: SQLiteDatabase): Promise<Profile | null> {
  return db.getFirstAsync<Profile>('SELECT * FROM profile LIMIT 1');
}

// Consent columns are left untouched on update so editing the profile never erases consent.
export async function saveProfile(db: SQLiteDatabase, p: ProfileFields): Promise<void> {
  await db.runAsync(
    `INSERT INTO profile (user_id, age, sex, weight_kg, height_cm, resting_hr, max_hr_est, fitness_level, usual_pace_kmh)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       age = excluded.age, sex = excluded.sex, weight_kg = excluded.weight_kg,
       height_cm = excluded.height_cm, resting_hr = excluded.resting_hr,
       max_hr_est = excluded.max_hr_est, fitness_level = excluded.fitness_level,
       usual_pace_kmh = excluded.usual_pace_kmh`,
    p.user_id, p.age, p.sex, p.weight_kg, p.height_cm, p.resting_hr,
    p.max_hr_est, p.fitness_level, p.usual_pace_kmh,
  );
}

export async function saveConsent(
  db: SQLiteDatabase,
  userId: string,
  version: string,
  atUtc: string,
): Promise<void> {
  await db.runAsync(
    'UPDATE profile SET consent_version = ?, consent_at = ? WHERE user_id = ?',
    version, atUtc, userId,
  );
}
