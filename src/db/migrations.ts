import type { SQLiteDatabase } from 'expo-sqlite';

// Each entry upgrades the schema by one version. Never edit a shipped entry; append a new one.
const MIGRATIONS: string[] = [
  // v1: full schema from spec section 7.1
  `
  CREATE TABLE profile (
    user_id TEXT PRIMARY KEY NOT NULL,
    age INTEGER NOT NULL,
    sex TEXT NOT NULL,
    weight_kg REAL NOT NULL,
    height_cm REAL NOT NULL,
    resting_hr INTEGER NOT NULL,
    max_hr_est INTEGER NOT NULL,
    fitness_level TEXT NOT NULL,
    usual_pace_kmh REAL NOT NULL,
    consent_version TEXT,
    consent_at TEXT
  );

  CREATE TABLE session (
    session_id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES profile(user_id),
    start_utc TEXT NOT NULL,
    end_utc TEXT,
    utc_offset_min INTEGER NOT NULL,
    reminder_interval_min INTEGER NOT NULL,
    sleep_quality INTEGER,
    water_carried_ml REAL,
    clothing_note TEXT,
    session_note TEXT,
    status TEXT NOT NULL,
    hc_synced_at TEXT
  );

  CREATE TABLE gps_point (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES session(session_id),
    ts_utc TEXT NOT NULL,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    speed_mps REAL,
    accuracy_m REAL,
    altitude_m REAL
  );
  CREATE INDEX idx_gps_point_session ON gps_point(session_id, ts_utc);

  CREATE TABLE hr_sample (
    session_id TEXT NOT NULL REFERENCES session(session_id),
    ts_utc TEXT NOT NULL,
    bpm REAL NOT NULL,
    source_app TEXT,
    record_id TEXT NOT NULL,
    UNIQUE (record_id, ts_utc)
  );
  CREATE INDEX idx_hr_sample_session ON hr_sample(session_id, ts_utc);

  CREATE TABLE steps_interval (
    session_id TEXT NOT NULL REFERENCES session(session_id),
    start_utc TEXT NOT NULL,
    end_utc TEXT NOT NULL,
    count INTEGER NOT NULL,
    record_id TEXT NOT NULL,
    UNIQUE (record_id, start_utc)
  );

  CREATE TABLE env_reading (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES session(session_id),
    ts_utc TEXT NOT NULL,
    air_temp_c REAL,
    humidity_pct REAL,
    source TEXT NOT NULL
  );

  CREATE TABLE prompt_answer (
    prompt_id TEXT PRIMARY KEY NOT NULL,
    session_id TEXT NOT NULL REFERENCES session(session_id),
    prompted_at_utc TEXT NOT NULL,
    answered_at_utc TEXT,
    trigger TEXT NOT NULL,
    status TEXT NOT NULL,
    rpe INTEGER,
    thirst INTEGER,
    felt_dizzy_or_cramp INTEGER,
    drank_water INTEGER,
    rested INTEGER
  );
  `,
  // v2: key/value store for app flags (manual checklist ticks, last check time)
  `
  CREATE TABLE app_setting (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
];

export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (let v = current; v < MIGRATIONS.length; v++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[v]);
      await db.execAsync(`PRAGMA user_version = ${v + 1}`);
    });
  }
}
