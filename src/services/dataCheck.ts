import type { SQLiteDatabase } from 'expo-sqlite';
import { getWorkoutFound } from '@/db/healthData';
import type { Session } from '@/types/models';

export type Light = 'good' | 'sparse' | 'missing';

export interface DataCheck {
  hrSampleCount: number;
  avgHrGapS: number | null;
  hrBinPct: number;
  stepsTotal: number;
  gpsPointCount: number;
  gpsMedianAccuracyM: number | null;
  labelsAnswered: number;
  labelsTotal: number;
  weatherRows: number;
  workoutFound: boolean | null;
  synced: boolean;
  light: Light;
}

const BIN_MS = 10_000;

export function lightFor(hrBinPct: number): Light {
  if (hrBinPct >= 80) return 'good';
  if (hrBinPct >= 10) return 'sparse';
  return 'missing';
}

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

async function count(db: SQLiteDatabase, sql: string, ...params: string[]): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(sql, ...params);
  return row?.n ?? 0;
}

// FR-21. Reads only what is stored; nothing is changed or filled in.
export async function computeDataCheck(db: SQLiteDatabase, session: Session): Promise<DataCheck> {
  const id = session.session_id;
  const startMs = Date.parse(session.start_utc);
  const endMs = session.end_utc ? Date.parse(session.end_utc) : Date.now();

  const hr = await db.getAllAsync<{ ts_utc: string }>(
    'SELECT ts_utc FROM hr_sample WHERE session_id = ? ORDER BY ts_utc',
    id,
  );
  const hrTimes = hr.map((r) => Date.parse(r.ts_utc));
  let avgHrGapS: number | null = null;
  if (hrTimes.length >= 2) {
    avgHrGapS = (hrTimes[hrTimes.length - 1] - hrTimes[0]) / (hrTimes.length - 1) / 1000;
  }

  // Same 10 s grid the export will use: bins start at session start.
  const binCount = Math.max(1, Math.ceil((endMs - startMs) / BIN_MS));
  const filled = new Set<number>();
  for (const t of hrTimes) {
    const b = Math.floor((t - startMs) / BIN_MS);
    if (b >= 0 && b < binCount) filled.add(b);
  }
  const hrBinPct = (filled.size / binCount) * 100;

  // Steps records can extend past the session, so only the overlapping share of each interval counts.
  const steps = await db.getAllAsync<{ start_utc: string; end_utc: string; count: number }>(
    'SELECT start_utc, end_utc, count FROM steps_interval WHERE session_id = ?',
    id,
  );
  let stepsTotal = 0;
  for (const s of steps) {
    const a = Date.parse(s.start_utc);
    const b = Date.parse(s.end_utc);
    const overlap = Math.min(b, endMs) - Math.max(a, startMs);
    if (overlap <= 0) continue;
    stepsTotal += b > a ? s.count * Math.min(1, overlap / (b - a)) : s.count;
  }

  const acc = await db.getAllAsync<{ accuracy_m: number }>(
    'SELECT accuracy_m FROM gps_point WHERE session_id = ? AND accuracy_m IS NOT NULL ORDER BY accuracy_m',
    id,
  );

  return {
    hrSampleCount: hr.length,
    avgHrGapS,
    hrBinPct,
    stepsTotal: Math.round(stepsTotal),
    gpsPointCount: await count(db, 'SELECT COUNT(*) AS n FROM gps_point WHERE session_id = ?', id),
    gpsMedianAccuracyM: median(acc.map((r) => r.accuracy_m)),
    labelsAnswered: await count(
      db,
      "SELECT COUNT(*) AS n FROM prompt_answer WHERE session_id = ? AND status = 'answered'",
      id,
    ),
    labelsTotal: await count(db, 'SELECT COUNT(*) AS n FROM prompt_answer WHERE session_id = ?', id),
    weatherRows: await count(db, 'SELECT COUNT(*) AS n FROM env_reading WHERE session_id = ?', id),
    workoutFound: await getWorkoutFound(db, id),
    synced: session.hc_synced_at !== null,
    light: lightFor(hrBinPct),
  };
}
